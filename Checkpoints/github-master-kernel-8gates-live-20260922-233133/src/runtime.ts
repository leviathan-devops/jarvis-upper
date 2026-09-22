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
import { guardrail } from "./guardrail";
import { appendTick, writeStatus, type RuntimeStatus } from "./status";
import { EventRail, parseSse } from "../ao-client/rail";
import { reduceEvent } from "./reducers";
import { health } from "../ao-client/client";
import { wireCapturePath } from "./status";
import { verify, type VerifyOpts, type VerifyResult } from "./verdict";
import { publishStatus, publishVerdict, type PublishResult } from "./publish";
import { STATUS_CONTEXTS } from "./status-contract";

export const DAEMON = process.env.AO_DAEMON ?? "http://localhost:3001";
const TICK_MS = Number(process.env.UPPER_TICK_MS ?? 15000);

export interface RuntimeDeps {
  probe?: () => Promise<boolean>;
  listPrs?: () => Promise<PrRow[]>;
  rails?: (db: Database, root: string) => Promise<RailCapture>;
  now?: () => Date;
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

export interface RailCapture { frames: number; bytes: number; lastSeq: number }

export async function defaultRails(db: Database, root: string): Promise<RailCapture> {
  try {
    const res = await fetch(`${DAEMON}/api/v1/events?after=0`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok || !res.body) return { frames: 0, bytes: 0, lastSeq: 0 };
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
      Bun.write(wireCapturePath(root), JSON.stringify({ ts: new Date().toISOString(), parsedFrames: parsed.length, newlyProcessed: frames.length, bytes: buf.length, lastSeq }, null, 2) + "\n");
    }
    return { frames: parsed.length, bytes: buf.length, lastSeq };
  } catch { return { frames: 0, bytes: 0, lastSeq: 0 }; }
}

export interface PublishVerdictForPrOpts {
  owner: string;
  repo: string;
  sha: string;
  token?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  jobDir: string;
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
  const v = await doVerify({ jobDir: opts.jobDir, headSha, sessionId, runFence: opts.runFence, fetchReviews: opts.fetchReviews, ledgerPath: opts.ledgerPath, bind: opts.bind });
  const fence2Ok = v.sources.fence.reason === "FENCE-GREEN";
  const verdictOk = v.verdict === "VERIFIED";
  const pubOpts = { owner: opts.owner, repo: opts.repo, sha: opts.sha, token: opts.token, baseUrl: opts.baseUrl, fetchImpl: opts.fetchImpl };
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
  const probe = deps.probe ?? defaultProbe;
  // EN-010: the default is the REAL adapter. A daemon tick that silently syncs
  // zero PRs is a wrong answer wearing a green light — so the default pulls AO.
  const listPrs = deps.listPrs ?? ((): Promise<PrRow[]> => listPrsFromAo());
  const rails = deps.rails ?? defaultRails;
  const now = deps.now ?? (() => new Date());

  const state = { running: false, tick: 0 };
  let last: RuntimeStatus | null = null;
  let timer: NodeJS.Timeout | null = null;

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
        // an IDLE stream (no new events since the cursor) is normal, not an error;
        // only the FIRST tick with zero frames is a real defect signal.
        if (cap.frames === 0 && state.tick === 1) errors.push("rail:0-frames-on-first-tick");
      } catch (e) { errors.push(`rail:${String(e).slice(0, 60)}`); }
    } else {
      errors.push("ECONNREFUSED");
    }

    const cs = db.query("SELECT last_seq FROM rail_seq WHERE source='ao-events'").get() as
      { last_seq: number } | null;
    const cursor = cs?.last_seq ?? 0;

    const readyRows = db.query("SELECT id FROM pr_node WHERE state='ready_to_merge'").all() as { id: string }[];
    const ready = readyRows.length;
    const eligible = readyRows.filter((r) => guardrail(db, r.id).ok).length;

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
      void tick();
      timer = setInterval(() => { void tick(); }, TICK_MS);
    },
    async stop() {
      state.running = false;
      if (timer) { clearInterval(timer); timer = null; }
      return last ?? (await tick());
    },
    status() { return last; },
  };
}
