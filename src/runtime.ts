// runtime.ts — the loop that owns TIME: boot · tick · stop.
// Side effects are injectable so the loop is testable without a daemon:
//   probe()   -> boolean      (default: GET /healthz)
//   listPrs() -> PrRow[]      (default: the REAL AO adapter — never a silent [])
//   rails()   -> number       (default: real SSE capture from the daemon)

import { Database } from "bun:sqlite";
import { openStore } from "./store";
import { syncPrs, type PrRow } from "./sync";
import { listPrsFromAo } from "./adapter-verbs";
import { orderMerges } from "./plan";
import { guardrail, guardrailRemote, recordGatePass, publishEligible } from "./guardrail";
import { fetchPrMerge, recordMerge, mergeRecorded } from "./merge-record";
import { appendTick, writeStatus, type RuntimeStatus } from "./status";
import type { ProjectSpec } from "./projects";
import { projectToken } from "./projects";
import { EventRail, parseSse } from "../ao-client/rail";
import { reduceEvent } from "./reducers";
import { health } from "../ao-client/client";
import { wireCapturePath } from "./status";
import { LEDGER_DEFAULT } from "./verdict";
import { verify, type VerifyOpts, type VerifyResult } from "./verdict";
import { publishStatus, publishVerdict, type PublishResult } from "./publish";
import { STATUS_CONTEXTS } from "./status-contract";

// FIXED (SLOP-11) then (ship gate LOW): `||` fixes "" but not a BLANK string ("   " is
// truthy) — every rails fetch would build an invalid URL. Trim, then fall back.
export const DAEMON = (process.env.AO_DAEMON ?? "").trim() || "http://localhost:3001";

/** The SSE capture ceiling. A buffer that hits it is TRUNCATED — a named failure,
 *  never a clean read (red-team audit W-12). */
// FIXED (ship-gate round HIGH): this repeated the validated-parse bug fixed for tickMs
// just below. Number("")===0 / Number("abc")===NaN — a present-but-invalid value made the
// cap 0 (TRUNCATED on every read) or NaN (`buf.length > NaN` is ALWAYS false -> the cap
// vanished and the buffer grew unbounded). Same guard as parseTickMs.
export const RAIL_MAX_BUF = ((): number => {
  const n = Math.floor(Number(process.env.RAIL_MAX_BUF ?? 65536));
  if (!Number.isFinite(n) || n <= 0) return 65536;
  // FIXED (ship-gate LOW): NO upper bound — RAIL_MAX_BUF=1000000000 disabled the cap and
  // let `buf` grow unbounded before the check fired. Clamp to a sane ceiling.
  return Math.min(n, 4 * 1024 * 1024);
})();

// FIXED 2026-09-23 (ocr round-4 HIGH): Number("")===0 / Number("abc")===NaN —
// a present-but-invalid env var produced a 0/NaN interval. Validate the parse.
export function parseTickMs(raw: string | undefined, fallback = 15000): number {
  const n = Number(raw ?? fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface RuntimeDeps {
  probe?: () => Promise<boolean>;
  listPrs?: () => Promise<PrRow[]>;
  rails?: (db: Database, root: string) => Promise<RailCapture>;
  now?: () => Date;
  tickMs?: number;
  // W5 — the publish target. When present, the tick publishes the two
  // factory/* statuses for every eligible PR (sha/headSha are per-PR).
  publishOpts?: Omit<PublishVerdictForPrOpts, "sha" | "headSha">;
}

export interface Runtime {
  tick(): Promise<RuntimeStatus>;
  start(): void;
  stop(): Promise<RuntimeStatus>;
  status(): RuntimeStatus | null;
  state: { running: boolean; tick: number };
}

export async function defaultProbe(): Promise<boolean> {
  try {
    const h = await health();
    return h.status === "ok";
  } catch { return false; }
}

export interface RailCapture {
  frames: number;
  bytes: number;
  lastSeq: number;
  // FIXED 2026-09-23 (muse independent review HIGH): the catch returned a
  // 0-frames SUCCESS, making a DEAD endpoint indistinguishable from an IDLE
  // stream — the tick's error branch (frames===0 && tick===1) only fired once,
  // so after tick 1 a dead rail reported daemonOk with empty errors forever.
  // The failure travels NAMED now.
  failed?: string;
}

export async function defaultRails(db: Database, root: string): Promise<RailCapture> {
  try {
    // FIXED 2026-09-23 (ocr round-4 CRITICAL): this fetched `after=0` on EVERY
    // tick — all history. Combined with the 65536-byte buffer cap, each tick
    // re-read the SAME first 64 KB; every event in it was already processed (the
    // rail dedupes by (source, seq)), so the capture returned 0 new frames and
    // events BEYOND the 64 KB window were NEVER fetched — the daemon silently
    // stopped processing live events on any non-trivial stream. Now the cursor
    // persisted in `rail_seq` is read BEFORE the fetch and passed as `after`.
    const cs = db.query("SELECT last_seq FROM rail_seq WHERE source='ao-events'").get() as
      { last_seq: number } | null;
    const after = cs?.last_seq ?? 0;
    const res = await fetch(`${DAEMON}/api/v1/events?after=${after}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok || !res.body) return { frames: 0, bytes: 0, lastSeq: 0, failed: `HTTP-${res.status}` };
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let bufBytes = 0;   // the incremental wire-byte count (never a whole-buffer recompute)
    let oversizedFrame = false;   // a single frame > RAIL_MAX_BUF (a named, non-progressing state)
    let readerCancelled = false;  // the timeout branch cancels; the post-loop cancel is skipped
    // FIXED 2026-09-23 (a RAIL TIMEOUT bug found on the LIVE daemon): the loop
    // checked `Date.now() < deadline` BEFORE `reader.read()`, but `read()` BLOCKS
    // on an IDLE stream until the 5 s AbortSignal fires — so a HEALTHY idle stream
    // reported `rail-failed:TimeoutError` on EVERY tick. The read now RACES the
    // remaining deadline: an idle SSE stream yields a clean, empty (not a failed)
    // capture, and a real network failure still surfaces.
    const started = Date.now();
    const DEADLINE_MS = 3000;
    let truncated = false;
    while (Date.now() - started < DEADLINE_MS) {
      const remaining = DEADLINE_MS - (Date.now() - started);
      if (remaining <= 0) break;
      const readP = reader.read();
      const result = await Promise.race([
        readP,
        new Promise<{ timeout: true }>((r) => setTimeout(() => r({ timeout: true }), remaining)),
      ]);
      if ("timeout" in result) {
        // W-13: a catch must log or rethrow. The cancel is best-effort cleanup of
        // an idle stream — the failure is named, the capture is still clean.
        // FIXED (the W15 ship gate LOW): TRACK the cancel so the post-loop cancel is skipped
        // (a second cancel on a healthy idle stream logged a spurious line every tick).
        try { await reader.cancel(); readerCancelled = true; } catch (e) { console.error(`rail-cancel:${String(e).slice(0, 60)}`); }
        break;
      }
      const { done, value } = result;
      if (done) { readerCancelled = true; break; }   // FIXED: a clean EOF needs no cancel
      buf += dec.decode(value, { stream: true });
      // FIXED (ship-gate LOW): `buf.length` counts UTF-16 code units, not wire bytes, so a
      // non-ASCII stream hit the "memory" limit at a different point than the cap implies.
      // FIXED (ship gate LOW): Buffer.byteLength over the WHOLE buffer each chunk made the
      // capture O(n^2). The chunks ARE the wire bytes — accumulate their lengths.
      bufBytes += value.byteLength;
      if (bufBytes > RAIL_MAX_BUF) {
        // FIXED (red-team audit W-12/R11): the old `break` abandoned the rest of
        // the stream and then parsed the TRUNCATED buffer as if it were a clean
        // capture — the cut frame was silently dropped and events past the window
        // starved with no signal. The truncation is now NAMED and reported.
        truncated = true;
        break;
      }
    }
    // FIXED (ship-gate LOW): reader.cancel() returns a promise; a sync try/catch does not
    // catch an async rejection (an unhandled rejection). Await it, as the timeout branch does.
    if (!readerCancelled) { try { await reader.cancel(); } catch (e) { console.error(`rail-cancel:${String(e).slice(0, 60)}`); } }
    // FIXED (the W15 ship gate MEDIUM): the decoder was never FLUSHED, so a split trailing
    // multi-byte char stayed buffered and its last frame was cut short. Flush it.
    buf += dec.decode();
    // FIXED (ship-gate MEDIUM): parseSse's flush() emits the final PARTIAL frame, so a
    // torn buffer ran reducers on half an event and advanced rail_seq past it. When the
    // capture is truncated, cut back to the last COMPLETE frame boundary ("\n\n").
    let parseBuf = buf;
    // FIXED (the W14 ship gate MEDIUM): the cut ran ONLY when truncated — a timeout/deadline
    // break also leaves `buf` mid-frame, and parseSse's flush() would emit the PARTIAL and
    // advance rail_seq past half an event. Cut whenever the capture did NOT end on a clean
    // frame boundary.
    const endsClean = /(?:\n\n|\r\n\r\n)$/.test(buf);
    if (truncated || !endsClean) {
      // FIXED (ship-gate MEDIUM): handle CRLF too — a `\r\n\r\n` stream yielded no cut
      // and discarded EVERY complete frame. Cut at the later of the two delimiters.
      const lf = buf.lastIndexOf("\n\n");
      const crlf = buf.lastIndexOf("\r\n\r\n");
      const cut = Math.max(lf >= 0 ? lf + 2 : -1, crlf >= 0 ? crlf + 4 : -1);
      parseBuf = cut > 0 ? buf.slice(0, cut) : "";
      // FIXED (the W14 ship gate MEDIUM): when a SINGLE frame exceeds the cap, cut is -1 and
      // the capture can never advance (the same `after` refetches forever). A DISTINCT
      // signal names the condition so a reader can tell it from an ordinary truncation.
      // FIXED (the W15 ship gate LOW): gate the signal on `truncated` — a tiny timeout
      // partial has cut<=0 but is NOT an oversize frame.
      if (cut <= 0 && truncated) {
        oversizedFrame = true;
        // FIXED (the W20 ship gate MEDIUM): the frame is UNPARSEABLE (it exceeds the cap), so
        // `attach` processes ZERO events, rail_seq never advances, and the next tick refetches
        // the SAME frame — an infinite refetch loop that also logs rail-failed every tick.
        // Consume it: read the frame's own `seq` from the partial buffer and advance past it.
        // FIXED (the W24 ship gate MEDIUM): parseSse derives seq primarily from the SSE `id:`
        // field; matching only JSON `"seq":` fell through to last_seq+1, which CRAWLS one seq
        // per tick across a gap. Match the `id:` frame form too.
        // FIXED (the W26 ship gate MEDIUM): parseSse derives seq from the SSE `id:` field —
        // matching a nested JSON `"seq"` FIRST could diverge from the cursor attach advances.
        const m = buf.match(/^id:\s*(\d+)\s*$/m) ?? buf.match(/"seq"\s*:\s*(\d+)/);
        // FIXED (the W21 ship gate MEDIUM): if the seq is ABSENT from the partial buffer the
        // cursor still could not advance (an infinite loop). Fall back to the highest seq we
        // have EVER seen + 1 — guaranteed forward progress past the unparseable frame.
        const dropped = m ? Number(m[1]) : (() => {
          const cur = db.query("SELECT last_seq FROM rail_seq WHERE source='ao-events'").get() as { last_seq: number } | null;
          return (cur?.last_seq ?? 0) + 1;
        })();
        {
          db.query(`INSERT INTO rail_seq(source, last_seq, updated_at) VALUES('ao-events', ?, strftime('%s','now'))
                    ON CONFLICT(source) DO UPDATE SET last_seq=MAX(last_seq, excluded.last_seq), updated_at=excluded.updated_at`).run(dropped);
          console.error(`rail-oversized-frame-dropped:seq=${dropped}:bytes=${bufBytes}:cap=${RAIL_MAX_BUF}`);
        }
      }
    }
    // FIXED (ship gate MEDIUM): parseSse splits on "\n" and treats only an EMPTY line as a
    // boundary, so interior "\r" blank lines were skipped and CRLF-delimited frames MERGED.
    // FIXED (the W14 ship gate HIGH): normalize ONCE — `parsed` used the normalized buffer
    // while `attach` received the RAW one, so the parse counted correctly but attach MERGED.
    const normalized = parseBuf.replace(/\r\n/g, "\n");
    const parsed = parseSse(normalized);      // what the wire actually carried
    const rail = new EventRail(db);
    const frames: number[] = [];
    await rail.attach([normalized], (ev) => { frames.push(ev.seq); reduceEvent(db, ev); });  // reducers' real caller
    // FIXED (ocr audit high): `Math.max(...arr)` spreads the WHOLE array onto the
    // call stack — a large SSE backlog (tens of thousands of frames) throws
    // RangeError and turned a busy stream into a tick-threw. A bounded loop.
    let lastSeq = 0;
    for (const e of parsed) if (e.seq > lastSeq) lastSeq = e.seq;
    // FIXED (ship-gate LOW): write the artifact whenever TRUNCATED, even with zero
    // complete frames — a post-mortem must tell truncated-empty from idle-empty.
    if (parsed.length > 0 || truncated) {
      // the wire-capture artifact: proof the adapter carried REAL bytes
      // FIXED (ship-gate LOW): the truncation flag is recorded IN the artifact, so a
      // post-mortem reader can tell a partial window from a complete one.
      await Bun.write(wireCapturePath(root), JSON.stringify({ ts: new Date().toISOString(), parsedFrames: parsed.length, newlyProcessed: frames.length, bytes: Buffer.byteLength(buf, "utf8"), lastSeq, ...(truncated ? { truncated: true, cap: RAIL_MAX_BUF } : {}) }, null, 2) + "\n");
    }
    // FIXED (red-team audit W-12): a truncated capture is a NAMED failure — the
    // caller must not treat a partial read as a clean one.
    // FIXED (ship gate MEDIUM): the cap check + the artifact use Buffer.byteLength, but
    // the RETURN used buf.length (UTF-16 units) — a non-ASCII stream mis-reported its size.
    return { frames: parsed.length, bytes: Buffer.byteLength(buf, "utf8"), lastSeq, ...(truncated ? { failed: oversizedFrame ? `TRUNCATED-SINGLE-FRAME-${RAIL_MAX_BUF}` : `TRUNCATED-${RAIL_MAX_BUF}` } : {}) };
  } catch (e) { return { frames: 0, bytes: 0, lastSeq: 0, failed: String(e).slice(0, 80) }; }
}

export interface PublishVerdictForPrOpts {
  owner: string;
  repo: string;
  sha: string;
  token?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  jobDir: string;
  jobDirFor?: (prId: string) => string;
  sessionId?: string;
  headSha?: string;
  verifyImpl?: (opts: VerifyOpts) => Promise<VerifyResult>;
  runFence?: VerifyOpts["runFence"];
  fetchReviews?: VerifyOpts["fetchReviews"];
  ledgerPath?: string;
  bind?: VerifyOpts["bind"];
  /** FIXED (THE OPERATIONAL GAP, measured live): the dedup hook. Called with the
   *  verdict key `<head>:<fence2Ok>:<verdictOk>` AFTER verify, BEFORE any POST.
   *  Return false to SKIP — the daemon was re-posting both contexts on EVERY tick
   *  (a live 15s POST storm; `lastPublished` was written but never read). */
  allowPublish?: (key: string) => boolean;
}

// W5 — publishVerdictForPr: the verdict -> publisher wire. A REAL verify()
// produces the two factory/* statuses the ruleset waits on.
//
// VERDICT->FLAG MAPPING (stated, never guessed):
//   fence2Ok  = verify.sources.fence.reason === "FENCE-GREEN"
//   verdictOk = verify.verdict === "VERIFIED"
// (verdictOk is the whole two-source law: BOTH sources green on the SAME head
// sha. fence2Ok is the fence half alone. An UNVERIFIED verdict therefore always
// posts at least one failure — the verdict context reads "verdict: not approved".)
//
// THE POLARITY LAW:
//   - a FAILED verify (UNVERIFIED) MUST produce at least one state:"failure"
//     (publishVerdict maps false -> "failure", so fence2Ok=false or
//     verdictOk=false each yield a red context).
//   - a verify that CANNOT RUN (the fence unreachable: runFence/fetchReviews
//     throw, the fence never ran, FENCE-NOT-RUN / FENCE-NO-INVARIANT-SHA sits in
//     reasons) MUST produce state:"error" for at least one context — NEVER a
//     green. This function detects the cannot-run shape and POSTs a direct
//     publishStatus error on factory/fence2, leaving verdictOk=false so the
//     second context stays red. A throwing POST rail likewise yields
//     state:"error" via publish.ts's LOUD-FAIL law — also never green.
export async function publishVerdictForPr(opts: PublishVerdictForPrOpts): Promise<PublishResult[]> {
  const headSha = opts.headSha ?? opts.sha;
  const sessionId = opts.sessionId ?? "";
  const doVerify = opts.verifyImpl ?? verify;
  const pubOpts = { owner: opts.owner, repo: opts.repo, sha: opts.sha, token: opts.token, baseUrl: opts.baseUrl, fetchImpl: opts.fetchImpl };
  // THE POLARITY LAW, throw branch: verify itself threw (neither fence nor
  // review could run — the state is UNKNOWN). Post an honest error on
  // factory/fence2 and a red verdict on factory/verdict. NEVER a green.
  let v: VerifyResult;
  try {
    v = await doVerify({ jobDir: opts.jobDir, headSha, sessionId, runFence: opts.runFence, fetchReviews: opts.fetchReviews, ledgerPath: opts.ledgerPath, bind: opts.bind });
  } catch (e) {
    // FIXED (ship gate MEDIUM): this branch POSTed UNCONDITIONALLY, bypassing the dedup
    // added for the other two branches — a persistently throwing verify re-posted both
    // contexts on EVERY tick (the same storm). Consult the hook first.
    // FIXED (the W26 ship gate MEDIUM): a 40-char slice of the message churned the key every
    // tick (a timestamp/counter inside it) while distinct errors sharing a prefix collided.
    const throwKey = `${headSha}:verify-threw:${new Bun.CryptoHasher("sha256").update(String(e)).digest("hex").slice(0, 16)}`;
    if (opts.allowPublish && !opts.allowPublish(throwKey)) {
      return [
        { context: STATUS_CONTEXTS.fence2, state: "error" as const, status: null, ok: true, reason: "ALREADY-PUBLISHED" },
        { context: STATUS_CONTEXTS.verdict, state: "failure" as const, status: null, ok: true, reason: "ALREADY-PUBLISHED" },
      ];
    }
    // The throw-branch POSTs are themselves guarded: publishStatus LOUD-FAILs
    // to state:"error" (never throws), but a defensive catch keeps the
    // polarity promise even if the POST rail misbehaves. NEVER a green.
    const desc = `VERIFY-THREW:${String(e).slice(0, 120)}`.slice(0, 140);
    let pair: PublishResult[];
    try {
      const fenceErr = await publishStatus(pubOpts, { context: STATUS_CONTEXTS.fence2, state: "error", description: desc });
      const red = await publishStatus(pubOpts, { context: STATUS_CONTEXTS.verdict, state: "failure", description: "verdict: not approved" });
      pair = [fenceErr, red];
    } catch (postErr) {
      pair = [
        { context: STATUS_CONTEXTS.fence2, state: "error" as const, status: null, ok: false, reason: `POST-THREW:${String(postErr).slice(0, 60)}` },
        { context: STATUS_CONTEXTS.verdict, state: "failure" as const, status: null, ok: false, reason: `POST-THREW:${String(postErr).slice(0, 60)}` },
      ];
    }
    return pair.map((r) => r.state === "success" ? { ...r, state: "failure" as const, ok: false, reason: "CANNOT-RUN-MUST-NOT-POST-SUCCESS" } : r);
  }
  // FIXED (the audit, MEASURED LIVE): a TRANSIENT produced no verdict at all — the fence was
  // KILLED, not answered. Publishing state:"error" for it writes an infrastructure hiccup into
  // a real PR's permanent status timeline. SKIP the publish entirely; the next tick re-runs.
  if (v.sources.fence.reason.startsWith("FENCE-TRANSIENT")) {
    return [
      { context: STATUS_CONTEXTS.fence2, state: "error" as const, status: null, ok: true, reason: "TRANSIENT-SKIPPED" },
      { context: STATUS_CONTEXTS.verdict, state: "failure" as const, status: null, ok: true, reason: "TRANSIENT-SKIPPED" },
    ];
  }
  const fence2Ok = v.sources.fence.reason === "FENCE-GREEN";
  const verdictOk = v.verdict === "VERIFIED";
  const cannotRun = v.sources.fence.ran === false && v.reasons.some((r) => r.startsWith("FENCE-"));
  if (cannotRun) {
    // FIXED (the dedup): a stable cannot-run key — re-posting the SAME error every
    // tick is the same storm. A change in the reasons re-posts (the key changes).
    // FIXED (ship gate MEDIUM): the key used reasons[0] while the posted description used
    // find(FENCE-*) — a mismatch meant a CHANGED fence error kept the same key (a missed
    // re-post) or an unrelated first reason changed the key (a spurious re-post). Same find.
    const crKey = `${headSha}:cannot-run:${(v.reasons.find((r) => r.startsWith("FENCE-")) ?? v.reasons[0] ?? "").slice(0, 40)}`;
    if (opts.allowPublish && !opts.allowPublish(crKey)) {
      return [
        { context: STATUS_CONTEXTS.fence2, state: "error" as const, status: null, ok: true, reason: "ALREADY-PUBLISHED" },
        { context: STATUS_CONTEXTS.verdict, state: "failure" as const, status: null, ok: true, reason: "ALREADY-PUBLISHED" },
      ];
    }
    // THE POLARITY LAW, cannot-run branch: the fence never ran, so its state is
    // UNKNOWN — an honest error, never a green and never a mere failure. POST the
    // error context directly, then the red verdict context. Zero success by construction.
    const desc = v.reasons.find((r) => r.startsWith("FENCE-"))?.slice(0, 140) ?? "fence unreachable";
    const fenceErr = await publishStatus(pubOpts, { context: STATUS_CONTEXTS.fence2, state: "error", description: desc });
    const red = await publishStatus(pubOpts, { context: STATUS_CONTEXTS.verdict, state: "failure", description: "verdict: not approved" });
    return [fenceErr, red].map((r) => r.state === "success" ? { ...r, state: "failure" as const, ok: false, reason: "CANNOT-RUN-MUST-NOT-POST-SUCCESS" } : r);
  }
  // FIXED (THE OPERATIONAL GAP, measured live): the dedup — a (pr, head, verdict) is
  // published ONCE. Posting an unchanged verdict every 15s hammered the GitHub API and
  // spammed the PR's statuses.
  const verdictKey = `${headSha}:${fence2Ok}:${verdictOk}`;
  if (opts.allowPublish && !opts.allowPublish(verdictKey)) {
    return [
      { context: STATUS_CONTEXTS.fence2, state: fence2Ok ? "success" as const : "failure" as const, status: null, ok: true, reason: "ALREADY-PUBLISHED" },
      { context: STATUS_CONTEXTS.verdict, state: verdictOk ? "success" as const : "failure" as const, status: null, ok: true, reason: "ALREADY-PUBLISHED" },
    ];
  }
  return publishVerdict(pubOpts, {
    fence2Ok,
    verdictOk,
    description: v.verdict === "VERIFIED" ? "verdict: approved" : v.reasons[0]?.slice(0, 140) ?? "verdict: not approved",
  });
}

export function createRuntime(opts: { root: string; db?: Database; deps?: RuntimeDeps; project?: ProjectSpec }): Runtime {
  // FIXED (ocr audit high): the publish dedup map is PER-RUNTIME. A module-scoped
  // map leaked across instances (tests, multiple roots) — a second instance skipped
  // a (prId, head) it never published. Keyed on "<head>:<fence2Ok>:<verdictOk>".
  const lastPublished = new Map<string, string>();
  const root = opts.root;
  // THE MULTI-PROJECT SCOPE: when a project is supplied, every root-relative path (the store,
  // the status, the wire capture, the tick log) resolves into `runtime/<id>/`, so N runtimes
  // never share a file. With NO project the paths are the legacy top-level ones — the
  // single-project behavior is byte-identical to before (zero regression).
  const project = opts.project;
  // the WIRE-CAPTURE dir (wireCapturePath appends "runtime/<file>" itself, so this is the
  // BASE): the project's own dir, or the legacy root.
  const WIRE_DIR = project ? `${root}/runtime/${project.id}` : root;
  const db = opts.db ?? openStore(project ? project.store : undefined);
  const deps = opts.deps ?? {};
  const tickMs = deps.tickMs ?? project?.tickMs ?? parseTickMs(process.env.UPPER_TICK_MS);
  const probe = deps.probe ?? defaultProbe;
  // EN-010: the default is the REAL adapter. A daemon tick that silently syncs
  // zero PRs is a wrong answer wearing a green light — so the default pulls AO.
  // FIXED (W26): unwrap the { rows, partialErrors } sync result; a partial is logged loudly.
  const listPrs = deps.listPrs ?? (async (): Promise<PrRow[]> => {
    const r = await listPrsFromAo();
    if (r.partialErrors.length > 0) console.error(`sync-partial:${r.partialErrors.length}`);
    return r.rows;
  });
  const rails = deps.rails ?? defaultRails;
  const now = deps.now ?? (() => new Date());
  // W5 — the publish target (absent by default: the tick publishes only when
  // a caller supplies it, so a bare runtime tick never POSTs to GitHub).
  // FIXED (multi-project): the publish target derives from the PROJECT (owner/repo/token from
  // the registry + the env-var NAME), so ONE daemon publishes to N repos with N credentials.
  // An explicit deps.publishOpts still wins (the test seam, and the legacy path).
  const projectPublishOpts = project ? ((): typeof deps.publishOpts => {
    const token = projectToken(project);
    if (!token) {
      console.error(`project-disarmed:${project.id}:no ${project.tokenEnv} — this project reads AO but will NEVER POST`);
      return undefined;
    }
    return {
      owner: project.owner, repo: project.repo, token,
      jobDir: "",
      jobDirFor: (prId: string) => {
        const session = prId.split(":")[1] ?? "";
        return session ? `${project.worktreeRoot}/${session}` : "";
      },
      ledgerPath: process.env.FENCE2_LEDGER,
    };
  })() : undefined;
  const publishOpts = deps.publishOpts ?? projectPublishOpts;
  const ledgerPath = (publishOpts as { ledgerPath?: string } | undefined)?.ledgerPath ?? LEDGER_DEFAULT;

  const state = { running: false, tick: 0, inFlight: false };
  let last: RuntimeStatus | null = null;
  let timer: NodeJS.Timeout | null = null;
  let inFlightPromise: Promise<unknown> | null = null;
  let everTicked = false;

  async function tick(): Promise<RuntimeStatus> {
    // FIXED (ocr audit high): the overlap guard lived only in start()'s wrapper,
    // so a direct/concurrent tick() interleaved state.tick++, the sync writes and
    // the publish dedup. The guard is now INSIDE tick(): a concurrent call returns
    // the last settled status instead of racing.
    // a concurrent caller gets the last SETTLED status; before the first tick
    // settles it gets a well-formed (empty) status, never an untyped {}.
    if (state.inFlight) return last ?? { ts: new Date(0).toISOString(), tick: state.tick, daemonOk: false, cursor: 0, prNodes: 0, ready: 0, eligible: 0, planHash: "", planKind: "none", kicks: 0, errors: ["TICK-IN-FLIGHT"] };
    state.inFlight = true;
    try {
    state.tick += 1;
    const errors: string[] = [];
    const daemonOk = await probe();

    let prNodes = 0;
    let planKind: RuntimeStatus["planKind"] = "none";
    let planHash: string | null = null;

    if (daemonOk) {
      try {
        const { rows } = await syncPrs(db, listPrs);
        prNodes = rows;
      } catch (e) { errors.push(`sync:${String(e).slice(0, 60)}`); }
      try {
        // MULTI-PROJECT: the rails writer receives the project's wire dir, so the capture
        // artifact lands in runtime/<id>/ (never in another project's evidence).
        // FIXED (the audit SLOP-05 — a PATH REGRESSION from the multi-project refactor):
        // wireCapturePath(base) joins `runtime/wire_capture.json` onto its argument, so the
        // legacy branch's `<root>/runtime` produced `<root>/runtime/runtime/wire_capture.json`
        // while gates/does_anything_run.sh and the frozen evidence read
        // `<root>/runtime/wire_capture.json`. The WIRE_DIR constant was declared with the
        // CORRECT base and a comment saying so, and never used.
        // FIXED (the audit SLOP-12): WIRE_DIR was declared with the correct base and a comment
        // saying so, and NEVER used — the inline literal below it was a second copy. The
        // constant is now the single authority for "where this project's wire capture lives".
        const cap = await rails(db, WIRE_DIR);
        // FIXED 2026-09-23 (muse HIGH): a NAMED failure is reported EVERY tick —
        // a dead rail can no longer hide as an idle stream behind daemonOk.
        if (cap.failed) errors.push(`rail-failed:${cap.failed}`);
        // an IDLE stream (no new events since the cursor) is normal, not an error;
        // only the FIRST tick with zero frames is a real defect signal.
        // FIXED (red-team audit, measured): 0 frames on the FIRST tick after a
        // restart is NORMAL — the persisted cursor already sits at the stream head,
        // so there is nothing new to read. The old signal made EVERY restart log an
        // error, training the reader to ignore `errors[]` (alarm fatigue — the exact
        // condition under which a REAL error hides). Only a cursor that is BEHIND a
        // non-empty stream is anomalous, and that is already covered by
        // `rail-failed` + the cursor-advance check.
        // FIXED (red-team slop audit SLOP-09): a branch computed a condition and then
        // did NOTHING (`void cap;`) — a real no-op in the tick path. The reasoning is
        // kept as the comment it always was; the dead statement is gone.
      } catch (e) { errors.push(`rail:${String(e).slice(0, 60)}`); }
    } else {
      errors.push("ECONNREFUSED");
    }

    const cs = db.query("SELECT last_seq FROM rail_seq WHERE source='ao-events'").get() as
      { last_seq: number } | null;
    const cursor = cs?.last_seq ?? 0;

    const readyRows = db.query("SELECT id, head_sha, session_id FROM pr_node WHERE state='ready_to_merge'").all() as
      { id: string; head_sha: string | null; session_id: string | null }[];
    const ready = readyRows.length;
    // FIXED 2026-09-23 (ocr final HIGH): sync the LOCAL gate_pass mirror from the
    // AUTHORITATIVE remote BEFORE the eligibility read — without this the mirror
    // was empty, so every PR read GATE-MISSING and STALE-GATE could never fire.
    // Best-effort: a failed remote read leaves the mirror's last value.
    if (publishOpts) {
      await Promise.allSettled(readyRows.filter((r) => r.head_sha).map(async (r) => {
        try {
          const e = await guardrailRemote({ owner: publishOpts.owner, repo: publishOpts.repo, sha: r.head_sha!, token: publishOpts.token, baseUrl: publishOpts.baseUrl, fetchImpl: publishOpts.fetchImpl });
          if (Object.keys(e.states).length > 0) recordGatePass(db, r.id, r.head_sha!, e.states);
        // W-13: a catch must LOG or rethrow (a comment-only body is a silent
        // fallback). The mirror sync is best-effort, so the failure is logged.
        } catch (e) { errors.push(`mirror:${String(e).slice(0, 60)}`); }
      }));
    }
    const eligible = readyRows.filter((r) => guardrail(db, r.id).ok).length;

    // W6 — RECORD THE TERMINAL EVENT (the DONE condition's second half). The
    // factory never merges (the human does), but it OBSERVES the merge and records
    // the merge commit's sha into the ledger. A PR in 'merge_ordered' that GitHub
    // reports as merged lands a ledger row and advances to 'merged'. Idempotent: a
    // re-polling tick never double-records the same merge sha.
    if (publishOpts) {
      // FIXED (the audit, DoD clause 8 — MEASURED LIVE): this polled ONLY `merge_ordered`, but
      // the sync's sticky-state CASE never advances a `ready_to_merge` row — so a PR that
      // merged while locally ready (the exact live case: PR #2 merged at 2026-09-29T18:01:45Z
      // as `ready_to_merge`) was INVISIBLE to the observer and its merge sha was never recorded.
      // FIXED (the ship gate HIGH — my FIRST fix polled only 2 states): a PR merged while
      // locally `open` (an admin merge before the mirror synced) was STILL invisible. The
      // observer now polls EVERY non-terminal state — open + ready_to_merge + merge_ordered —
      // and records the merge whenever GitHub reports one (rejected/kicked cannot merge; merged
      // is terminal). This is the honest reading of "EVERY pre-merge state".
      const orderedRows = db.query("SELECT id, pr_number, head_sha, session_id FROM pr_node WHERE state IN ('open','ready_to_merge','merge_ordered')").all() as
        { id: string; pr_number: number; head_sha: string | null; session_id: string | null }[];
      for (const r of orderedRows) {
        try {
          const m = await fetchPrMerge({ owner: publishOpts.owner, repo: publishOpts.repo, prNumber: r.pr_number, token: publishOpts.token ?? "", baseUrl: publishOpts.baseUrl, fetchImpl: publishOpts.fetchImpl });
          if (m.merged && m.mergeCommitSha && !mergeRecorded(ledgerPath, m.mergeCommitSha)) {
            const recorded = recordMerge(ledgerPath, { prId: r.id, prNumber: r.pr_number, mergeSha: m.mergeCommitSha, headSha: r.head_sha ?? "", session: r.session_id ?? "" });
            if (recorded) db.query("UPDATE pr_node SET state='merged' WHERE id = ?").run(r.id);
            else errors.push(`merge-record:${r.id}`);
          }
        } catch (e) { errors.push(`merge-poll:${String(e).slice(0, 60)}`); }
      }
    }

    // W5 — publish the verdict for every ELIGIBLE PR. The two `factory/*`
    // contexts the ruleset requires are posted here. A publish failure MUST
    // NEVER crash the tick: it is logged into errors[] and the tick continues.
    // Only eligible PRs publish (an ineligible PR has nothing to certify yet).
    if (publishOpts) {
      // FIXED (the audit — CRITICAL A, THE SELF-LATCH): this used the FULL guardrail, which
      // includes the gates THIS PROCESS publishes. The mirror writes those back before the
      // read, so one transient failure (a SIGTERMed fence → exit 143) permanently disabled the
      // publisher — the daemon could never clear the red it had published. The publisher gates
      // on its INPUTS (the GitHub Actions jobs) only. `guardrail` still governs the merge order.
      const guardrailCache = new Map<string, boolean>();
      const isEligible = (id: string) => { if (!guardrailCache.has(id)) guardrailCache.set(id, publishEligible(db, id).ok); return guardrailCache.get(id)!; };
      // FIXED (ao-review-4 round 2 finding): the tick posted EVERY eligible PR on
      // EVERY tick (a 15s POST storm per PR). A (pr, head) is published ONCE: the
      // dedup is keyed on the head sha, so a NEW head publishes again but an
      // unchanged head is skipped.
      // FIXED (ocr audit high): this filter keyed on the HEAD alone, so a verdict
      // CHANGE on the same head (a review arriving after the fence published red)
      // never reached publishVerdictForPr — whose OWN dedup is keyed on the verdict
      // state. The head filter is removed; the verdict-state dedup below decides.
      const publishable = readyRows.filter((r) => isEligible(r.id) && r.head_sha);
      // F23: bounded parallel publish (max 4 concurrent)
      const PUB_CONC = 4;
      for (let i = 0; i < publishable.length; i += PUB_CONC) {
        const batch = publishable.slice(i, i + PUB_CONC);
        const batchResults = await Promise.allSettled(batch.map(async (r) => {
          const headSha = r.head_sha!;
          const jobDir = typeof publishOpts.jobDirFor === "function" ? publishOpts.jobDirFor(r.id) : publishOpts.jobDir;
          if (!jobDir) return `publish:${r.id}:NO-JOBDIR`;
          try {
            // FIXED (the dedup was DEAD: lastPublished was SET but never READ, so the
            // daemon re-posted both contexts every tick). The hook now consults it, and
            // the key (head:fence2Ok:verdictOk) is recorded only on a FULL success.
            let seenKey: string | null = null;
            const allowPublish = (key: string) => { seenKey = key; return lastPublished.get(r.id) !== key; };
            const results = await publishVerdictForPr({ ...publishOpts, sha: headSha, headSha, sessionId: r.session_id ?? "", jobDir, allowPublish });
            const skipped = results.every((rr) => rr.reason === "ALREADY-PUBLISHED");
            const transient = results.every((rr) => rr.reason === "TRANSIENT-SKIPPED");
            if (transient) return `publish:${r.id}:FENCE-TRANSIENT-SKIPPED`;   // loud in errors[], no POST
            const bad = results.filter((rr) => !rr.ok && rr.reason !== "ALREADY-PUBLISHED");
            // record the published key ONLY when every context posted (a partial
            // publish must retry on the next tick, never be marked done)
            if (bad.length === 0 && seenKey && !skipped) lastPublished.set(r.id, seenKey);
            if (bad.length > 0) return `publish:${r.id}:${bad.map((b) => b.reason).join(";").slice(0, 60)}`;
          } catch (e) {
            return `publish:${r.id}:${String(e).slice(0, 60)}`;
          }
          return null;
        }));
        for (const r of batchResults) { if (r.status === 'fulfilled' && r.value) errors.push(r.value); else if (r.status === 'rejected') errors.push(`publish:${String(r.reason).slice(0,60)}`); }
      }
    }

    const plan = orderMerges(db);
    planKind = plan.kind as RuntimeStatus["planKind"];
    if (plan.kind === "ok") {
      planHash = new Bun.CryptoHasher("sha256").update(plan.order.join(",")).digest("hex").slice(0, 16);
    }

    const s: RuntimeStatus = {
      ts: now().toISOString(), tick: state.tick, daemonOk, cursor,
      prNodes, ready, eligible, planHash, planKind, kicks: 0, errors,
    };
    // THE MULTI-PROJECT STATUS: an id routes the write into runtime/<id>/; with no project it
    // is the legacy top-level file (byte-identical to before).
    writeStatus(root, s, project?.id);
    appendTick(root, s, project?.id);
    last = s;
    return s;
    } catch (e) {
      // FIXED (ocr audit high): a THROWN tick (a db.query, orderMerges, writeStatus,
      // or a publish throw) bubbled out with `last` STALE and NO status written — a
      // direct caller got a rejection and a reader saw a frozen status. A tick now
      // ALWAYS yields a well-formed status naming the throw, and always writes it.
      const s: RuntimeStatus = {
        ts: new Date().toISOString(), tick: state.tick, daemonOk: false,
        cursor: last?.cursor ?? 0, prNodes: last?.prNodes ?? 0,
        ready: 0, eligible: 0, planHash: null, planKind: "none", kicks: 0,
        errors: [...(last?.errors ?? []), `tick-threw:${String(e).slice(0, 100)}`],
      };
      // FIXED (red-team audit S16): the old catch was comment-only, so a failed write
      // left status.json holding the PREVIOUS tick while the in-memory caller got an
      // error status — every FILE reader (verbStatus, a watchdog) saw a healthy-
      // looking stale tick during an outage. Surfaced IN the returned status now.
      try { writeStatus(root, s, project?.id); appendTick(root, s, project?.id); }
      catch (we) { s.errors.push(`status-write-failed:${String(we).slice(0, 60)}`); }
      last = s;
      return s;
    } finally { state.inFlight = false; }
  }

  return {
    state,
    tick,
    start() {
      if (state.running) return;
      state.running = true;
      // FIXED (ocr audit CRITICAL): this set state.inFlight=true BEFORE calling
      // tick(), and tick() early-returns when inFlight is true -> every scheduled
      // tick (including the first) was a NO-OP and the daemon never advanced. The
      // lock now lives ONLY inside tick(); safeTick skips when one is in flight.
      const safeTick = () => { if (state.inFlight) return; everTicked = true; inFlightPromise = tick().catch((e) => { console.error(`tick-error: ${String(e).slice(0,120)}`); }).finally(() => { state.inFlight = false; }); };
      safeTick();
      timer = setInterval(safeTick, tickMs);
    },
    async stop() {
      state.running = false;
      if (timer) { clearInterval(timer); timer = null; }
      // FIXED 2026-09-23 (ocr round-4 HIGH x2): (a) `last ?? await tick()`
      // launched a SECOND concurrent tick when one was in flight; (b) the first
      // fix's bounded loop could time out and STILL launch the second tick. Now
      // stop() awaits the ACTUAL in-flight promise (the tick is internally
      // timeout-bounded), so no racetick can ever run.
      // FIXED (ocr audit high): `if (last) return last` ran BEFORE awaiting the
      // in-flight tick, so stopping mid-tick returned a STALE status and left the
      // publish unawaited. The in-flight promise is awaited FIRST.
      if (inFlightPromise) await inFlightPromise;
      if (last) return last;
      // FIXED 2026-09-23 (qwen-code-audit run 3 CRITICAL): if the awaited tick
      // THREW, `last ?? await tick()` launched a SECOND tick at stop time. stop()
      // now runs a tick ONLY when none has EVER run and none is in flight; a
      // status is synthesized otherwise (never a racing tick).
      if (!state.inFlight && !everTicked) { everTicked = true; return tick(); }
      return last ?? { ts: now().toISOString(), tick: state.tick, daemonOk: false, cursor: 0,
        prNodes: 0, ready: 0, eligible: 0, planHash: null, planKind: "none", kicks: 0,
        errors: ["stop-no-status"] };
    },
    status() { return last; },
  };
}
