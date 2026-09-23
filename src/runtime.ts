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
import { guardrail, guardrailRemote, recordGatePass } from "./guardrail";
import { appendTick, writeStatus, type RuntimeStatus } from "./status";
import { EventRail, parseSse } from "../ao-client/rail";
import { reduceEvent } from "./reducers";
import { health } from "../ao-client/client";
import { wireCapturePath } from "./status";
import { verify, type VerifyOpts, type VerifyResult } from "./verdict";
import { publishStatus, publishVerdict, type PublishResult } from "./publish";
import { STATUS_CONTEXTS } from "./status-contract";

export const DAEMON = process.env.AO_DAEMON ?? "http://localhost:3001";

// FIXED 2026-09-23 (ocr round-4 HIGH): Number("")===0 / Number("abc")===NaN —
// a present-but-invalid env var produced a 0/NaN interval. Validate the parse.
function parseTickMs(raw: string | undefined, fallback = 15000): number {
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
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      if (buf.length > 65536) break;
    }
    try { reader.cancel(); } catch { /* stream already closed */ }
    const parsed = parseSse(buf);           // what the wire actually carried
    const rail = new EventRail(db);
    const frames: number[] = [];
    await rail.attach([buf], (ev) => { frames.push(ev.seq); reduceEvent(db, ev); });  // reducers' real caller
    const lastSeq = parsed.length > 0 ? Math.max(...parsed.map((e) => e.seq)) : 0;
    if (parsed.length > 0) {
      // the wire-capture artifact: proof the adapter carried REAL bytes
      await Bun.write(wireCapturePath(root), JSON.stringify({ ts: new Date().toISOString(), parsedFrames: parsed.length, newlyProcessed: frames.length, bytes: buf.length, lastSeq }, null, 2) + "\n");
    }
    return { frames: parsed.length, bytes: buf.length, lastSeq };
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
  const fence2Ok = v.sources.fence.reason === "FENCE-GREEN";
  const verdictOk = v.verdict === "VERIFIED";
  const cannotRun = v.sources.fence.ran === false && v.reasons.some((r) => r.startsWith("FENCE-"));
  if (cannotRun) {
    // THE POLARITY LAW, cannot-run branch: the fence never ran, so its state is
    // UNKNOWN — an honest error, never a green and never a mere failure. POST the
    // error context directly, then the red verdict context. Zero success by construction.
    const desc = v.reasons.find((r) => r.startsWith("FENCE-"))?.slice(0, 140) ?? "fence unreachable";
    const fenceErr = await publishStatus(pubOpts, { context: STATUS_CONTEXTS.fence2, state: "error", description: desc });
    const red = await publishStatus(pubOpts, { context: STATUS_CONTEXTS.verdict, state: "failure", description: "verdict: not approved" });
    return [fenceErr, red].map((r) => r.state === "success" ? { ...r, state: "failure" as const, ok: false, reason: "CANNOT-RUN-MUST-NOT-POST-SUCCESS" } : r);
  }
  return publishVerdict(pubOpts, {
    fence2Ok,
    verdictOk,
    description: v.verdict === "VERIFIED" ? "verdict: approved" : v.reasons[0]?.slice(0, 140) ?? "verdict: not approved",
  });
}

export function createRuntime(opts: { root: string; db?: Database; deps?: RuntimeDeps }): Runtime {
  const root = opts.root;
  const db = opts.db ?? openStore();
  const deps = opts.deps ?? {};
  const tickMs = deps.tickMs ?? parseTickMs(process.env.UPPER_TICK_MS);
  const probe = deps.probe ?? defaultProbe;
  // EN-010: the default is the REAL adapter. A daemon tick that silently syncs
  // zero PRs is a wrong answer wearing a green light — so the default pulls AO.
  const listPrs = deps.listPrs ?? ((): Promise<PrRow[]> => listPrsFromAo());
  const rails = deps.rails ?? defaultRails;
  const now = deps.now ?? (() => new Date());
  // W5 — the publish target (absent by default: the tick publishes only when
  // a caller supplies it, so a bare runtime tick never POSTs to GitHub).
  const publishOpts = deps.publishOpts;

  const state = { running: false, tick: 0, inFlight: false };
  let last: RuntimeStatus | null = null;
  let timer: NodeJS.Timeout | null = null;
  let inFlightPromise: Promise<unknown> | null = null;
  let everTicked = false;

  async function tick(): Promise<RuntimeStatus> {
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
        const cap = await rails(db, root);
        // FIXED 2026-09-23 (muse HIGH): a NAMED failure is reported EVERY tick —
        // a dead rail can no longer hide as an idle stream behind daemonOk.
        if (cap.failed) errors.push(`rail-failed:${cap.failed}`);
        // an IDLE stream (no new events since the cursor) is normal, not an error;
        // only the FIRST tick with zero frames is a real defect signal.
        else if (cap.frames === 0 && state.tick === 1) errors.push("rail:0-frames-on-first-tick");
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

    // W5 — publish the verdict for every ELIGIBLE PR. The two `factory/*`
    // contexts the ruleset requires are posted here. A publish failure MUST
    // NEVER crash the tick: it is logged into errors[] and the tick continues.
    // Only eligible PRs publish (an ineligible PR has nothing to certify yet).
    if (publishOpts) {
      const guardrailCache = new Map<string, boolean>();
      const isEligible = (id: string) => { if (!guardrailCache.has(id)) guardrailCache.set(id, guardrail(db, id).ok); return guardrailCache.get(id)!; };
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
            const results = await publishVerdictForPr({ ...publishOpts, sha: headSha, headSha, sessionId: r.session_id ?? "", jobDir });
            const bad = results.filter((rr) => !rr.ok);
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
    writeStatus(root, s);
    appendTick(root, s);
    last = s;
    return s;
  }

  return {
    state,
    tick,
    start() {
      if (state.running) return;
      state.running = true;
      const safeTick = () => { if (state.inFlight) return; state.inFlight = true; everTicked = true; inFlightPromise = tick().catch((e) => { console.error(`tick-error: ${String(e).slice(0,120)}`); }).finally(() => { state.inFlight = false; }); };
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
      if (last) return last;
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
