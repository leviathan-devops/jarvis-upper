// main.ts — THE ENTRY POINT: the MULTI-PROJECT async orchestrator.
//
// Run:  UPPER_TICK_MS=15000 bun src/main.ts
//
// THE SHAPE: the daemon loads a REGISTRY of projects (src/projects.ts) and drives their
// ticks CONCURRENTLY through ONE cadence. Each project owns its store, its status file, its
// worktree root, and its credential — so N projects are N isolated units of work, not N
// serialized passes over shared state.
//
// THE ISOLATION LAW (what makes it safe to run a fleet):
//   1. SETTLE-ALL PER CYCLE — `Promise.allSettled` over the projects. One project throwing
//      never blocks or cancels the others; its failure lands in ITS row of the aggregate.
//   2. PER-PROJECT STORES — SQLite has ONE writer. N projects on one file = SQLITE_BUSY
//      storms and a shared crash domain. Each project gets its own store (src/projects.ts).
//   3. PER-PROJECT CREDENTIALS — a project names its token's ENV VAR; the bytes never touch
//      the registry. A project with no token is DISARMED BY NAME, not silently.
//   4. A DISABLED PROJECT IS NAMED EVERY CYCLE — never a silent skip.
//
// FIXED (ship-gate LOW): the module had IMPORT side effects — the target check's
// process.exit(1), the DISARMED log, createRuntime(), the signal handlers, and the
// started log all ran on import (only rt.start() was guarded). A module must be
// side-effect-free on import, so EVERY side effect now lives in main().
import { fileURLToPath } from "node:url";
import { createRuntime, parseTickMs, type Runtime } from "./runtime";
import { targetMatchesRemote } from "./target-guard";
import { statusPath, ticksPath, writeAggregate, appendTick, projectStatusPath, type ProjectStatusRow, type RuntimeStatus } from "./status";
import { readFileSync, existsSync } from "node:fs";
import { loadRegistry, projectToken, type ProjectSpec, type ProjectIssue } from "./projects";

// FIXED 2026-09-23 (ocr round-4 HIGH): new URL().pathname is not a filesystem
// path (wrong on Windows, and URL-encoded elsewhere) — fileURLToPath is the
// correct conversion.
// FIXED (run 4): `??` lets an EMPTY UPPER_ROOT through (root="") — `||`.
const root = process.env.UPPER_ROOT || fileURLToPath(new URL("..", import.meta.url));
// FIXED 2026-09-23 (ocr round-4 HIGH): Number("") === 0 and Number("abc")
// === NaN — an empty/invalid env var produced a 0/NaN interval (a runaway
// tick storm). The default now applies to a parsed-but-invalid value too.
// FIXED (the W24 ship gate MEDIUM): this was a SECOND authority for the same env parse
// (runtime.ts owns parseTickMs). One implementation.
const tickMs = parseTickMs(process.env.UPPER_TICK_MS);

/** One enrolled project: its spec, its runtime, and why it is (or is not) armed. */
export interface Enrolled { spec: ProjectSpec; rt: Runtime; ok: boolean; reason?: string; }

let signalsWired = false;   // FIXED: our OWN registration flag, not the global listener count

/** THE ENROLLMENT: validate each project's TARGET against ITS OWN tree's origin and build its
 *  runtime. A failed project is KEPT with `ok:false` + its reason — never dropped silently, so
 *  the aggregate shows exactly which project is dark and why. */
function enroll(root: string, spec: ProjectSpec, host: string): Enrolled {
  const tgt = targetMatchesRemote({ root: spec.root, owner: spec.owner, repo: spec.repo, host });
  if (!tgt.ok) {
    return { spec, rt: createRuntime({ root, project: spec }), ok: false,
      reason: `TARGET:${tgt.reason ?? "MISMATCH"} (this tree's origin is ${tgt.remote || "(unreadable)"}, the registry names ${spec.owner}/${spec.repo})` };
  }
  if (!projectToken(spec)) {
    // the runtime handles the disarm (it logs project-disarmed); the enrollment records it
    // so the AGGREGATE carries the state rather than an empty error list.
    return { spec, rt: createRuntime({ root, project: spec }), ok: true, reason: `DISARMED:no ${spec.tokenEnv}` };
  }
  return { spec, rt: createRuntime({ root, project: spec }), ok: true };
}

/** THE CYCLE FACTORY (exported for the test — SLOP-10). ONE cadence over N projects,
 *  settle-all: a project that THROWS lands in ITS row with the error named, the count rises,
 *  and every other project is untouched. The aggregate carries the legacy top-level fields
 *  (so pre-existing readers keep working) PLUS the per-project rows. */
export function makeCycle(enrolled: Enrolled[], root: string, next: () => number): () => Promise<void> {
  // FIXED (the audit SLOP-09): the orchestrator had NO cycle-level re-entrancy guard. A cycle
  // whose remote reads overran the interval overlapped the next one, so two cycles ran
  // `next()` (two tick numbers for one interval) and interleaved the status write. Worse, the
  // OLD synthetic row for an overrun was recorded `ok: e.ok` (true!) and NOT counted in
  // `failed` — an overrunning cycle read GREEN. A concurrent call is now SKIPPED with a LOUD,
  // honest row (`ok:false`, `CYCLE-IN-FLIGHT`, counted in `failed`), never a silent overlap.
  let inFlight = false;
  return async (): Promise<void> => {
    if (inFlight) {
      // FIXED (the ship gate HIGH): the FIRST fix wrote a synthetic tick:0/daemonOk:false
      // aggregate — which REGRESSED the tick number (legacy readers + the drift sweep expect a
      // MONOTONIC tick) and spuriously flipped the fleet GREEN→RED for a cycle that simply did
      // not run. A skipped cycle now writes NOTHING: the last healthful aggregate stands, and
      // the skip is LOUD on stderr. (The re-entrancy itself is already prevented by the guard.)
      console.error("cycle-skipped:CYCLE-IN-FLIGHT (the previous cycle is still running)");
      return;
    }
    inFlight = true;
    try {
    const n = next();
    const settled = await Promise.allSettled(enrolled.map(async (e) => {
      if (!e.ok) throw new Error(e.reason ?? "NOT-ENROLLED");
      if (!e.rt) throw new Error("ENROLL-FAILED:no runtime");
      return await e.rt.tick();
    }));
    const rows: Record<string, ProjectStatusRow> = {};
    let failed = 0;
    const errors: string[] = [];
    for (let i = 0; i < settled.length; i++) {
      const e = enrolled[i];
      const r = settled[i];
      if (r.status === "fulfilled") {
        if (e.reason) {
          // FIXED (the ship gate medium): a DISARMED project's red row was NOT counted in
          // `failed` nor named in the top-level errors — so `failed===0 && errors===[]` could
          // coexist with a red fleet row, hiding the disarm from a health check. Counted now.
          failed += 1;
          errors.push(`${e.spec.id}:${e.reason}`);
          // FIXED (ship gate medium): a disarmed row preserved r.value.daemonOk (often true) while
          // the rejected branch forces false — two failed paths disagreeing, so the aggregate's
          // `every(daemonOk)` could stay true with failed>0. Both failed paths agree now.
          rows[e.spec.id] = { ...r.value, daemonOk: false, ok: false, error: e.reason, errors: [...(r.value.errors ?? []), `enrolled:${e.reason}`] };
        } else {
          rows[e.spec.id] = { ...r.value, ok: true };
        }
      } else {
        failed += 1;
        errors.push(`${e.spec.id}:${String(r.reason).slice(0, 120)}`);
        const last = ((): RuntimeStatus | null => {
          try { const q = projectStatusPath(root, e.spec.id); return existsSync(q) ? (JSON.parse(readFileSync(q, "utf8")) as RuntimeStatus) : null; }
          catch { return null; }
        })();
        rows[e.spec.id] = {
          ts: new Date().toISOString(), tick: last?.tick ?? 0, daemonOk: false, cursor: last?.cursor ?? 0,
          prNodes: last?.prNodes ?? 0, ready: last?.ready ?? 0, eligible: last?.eligible ?? 0,
          planHash: last?.planHash ?? null, planKind: last?.planKind ?? "none", kicks: 0,
          errors: [`tick-threw:${String(r.reason).slice(0, 100)}`], ok: false, error: String(r.reason).slice(0, 200),
        };
      }
    }
    const all = Object.values(rows);
    const sum = (f: (r: ProjectStatusRow) => number) => all.reduce((a, r) => a + f(r), 0);
    const agg = {
      ts: new Date().toISOString(), tick: n,
      daemonOk: all.length > 0 && all.every((r) => r.daemonOk),
      cursor: Math.max(0, ...all.map((r) => r.cursor)),
      prNodes: sum((r) => r.prNodes), ready: sum((r) => r.ready), eligible: sum((r) => r.eligible),
      planHash: all.length === 1 ? all[0].planHash : null,
      planKind: (all.length > 0 && all.every((r) => r.planKind === "ok") ? "ok" : "none") as RuntimeStatus["planKind"],
      kicks: sum((r) => r.kicks), errors,
      projects: rows, failed,
    };
    writeAggregate(root, agg as never);
    appendTick(root, { ts: agg.ts, tick: n, daemonOk: agg.daemonOk, cursor: agg.cursor,
      prNodes: agg.prNodes, ready: agg.ready, eligible: agg.eligible,
      planHash: null, planKind: agg.planKind, kicks: agg.kicks, errors });
    } finally { inFlight = false; }
  };
}

export async function main(): Promise<void> {
  const reg = loadRegistry(root, process.env);
  const host = (process.env.UPPER_HOST ?? "").trim() || "github.com";

  // an ISSUE is a named, skipped entry — never fatal, never silent.
  for (const i of reg.issues as ProjectIssue[]) console.error(`project-issue:${i.id}:${i.reason}`);

  // FIXED (the audit SLOP-01): a CONSTRUCTION failure (an unopenable store, an unreadable
  // tree) must be a DARK ROW, never a dead daemon. The registry promises "it never takes the
  // daemon down" — this is where that promise is kept. The runtime is built LAZILY so a throw
  // is caught here rather than escaping the map.
  const enrolled: Enrolled[] = reg.projects.map((spec) => {
    try { return enroll(root, spec, host); }
    catch (e) {
      console.error(`project-enroll-failed:${spec.id}:${String(e).slice(0, 120)}`);
      return { spec, rt: null as unknown as Runtime, ok: false, reason: `ENROLL-FAILED:${String(e).slice(0, 140)}` };
    }
  });

  // THE CONCURRENT CYCLE. ONE cadence drives N projects; settle-all isolates them.
  // FIXED (the audit SLOP-10): the orchestrator had ZERO functional coverage — no test could
  // reach this cycle, and FOUR HIGH defects lived in this file. The cycle is now a NAMED,
  // EXPORTED factory the tests drive directly.
  let cycle = 0;
  const tickCycle = makeCycle(enrolled, root, () => ++cycle);

  // FIXED (the audit SLOP-11): `tickMs` was documented and validated but INERT — consumed only
  // by Runtime.start(), which main() never calls (main drives its OWN cycle). The fleet
  // cadence now honours UPPER_TICK_MS; a per-project override applies only when EVERY project
  // agrees on a value (a single cadence cannot honour N disagreeing intervals — the min wins,
  // so no project is starved).
  // FIXED (the ship gate medium): requiring EVERY project to define tickMs silently DROPPED a
  // partial override. The cadence is now the MIN of the DEFINED per-project intervals (a faster
  // project is honoured; a slower one still gets the global cadence — no project is starved, and
  // the ignoring of partial overrides is NAMED).
  // FIXED (the ship gate HIGH): taking the min of ONLY the DEFINED overrides IGNORED the global
  // for a project that left tickMs undefined — one slow override dragged the WHOLE fleet slower
  // than the default, starving the project expecting the global cadence. Each project resolves
  // to its OWN interval (spec.tickMs ?? the global); the fleet cadence is the MIN of those.
  // FIXED (the whole-file scan HIGH): a per-project tickMs was UNVALIDATED (`0`/negative/NaN
  // flowed into setInterval → a runaway storm or a never-firing cadence). Validated like the
  // global parseTickMs; an invalid value is NAMED and ignored.
  const timerValid = enrolled.map((e) => {
    const t = e.spec.tickMs;
    if (t === undefined) return tickMs;
    const ok = typeof t === "number" && Number.isFinite(t) && t >= 1000;
    if (!ok) console.error(`tickMs-invalid:${e.spec.id}:${String(t)} — using the global ${tickMs}`);
    return ok ? t : tickMs;
  });
  const resolved = timerValid;
  const effTickMs = resolved.length > 0 ? Math.min(...resolved) : tickMs;
  if (effTickMs !== tickMs) console.error(`tickMs-override:${tickMs}->${effTickMs} (the min of the ${resolved.length} RESOLVED per-project intervals)`);
  const timer = setInterval(() => void tickCycle().catch((e) => console.error(`cycle-threw:${String(e).slice(0, 120)}`)), effTickMs);

  const armed = enrolled.filter((e) => e.ok && !e.reason).length;
  const disarmed = enrolled.filter((e) => e.ok && e.reason).length;
  const dark = enrolled.filter((e) => !e.ok).length;

  let stopping = false;
  async function stop(): Promise<void> {
    // FIXED 2026-09-23 (ocr final HIGH): the guard made a SECOND signal a silent
    // no-op — if the first stop() hung on a network call, the daemon was unkillable
    // by signals. A second signal now ESCALATES to a forced exit.
    if (stopping) { console.error(JSON.stringify({ forced: true, reason: "second-signal" })); process.exit(1); }
    stopping = true;
    clearInterval(timer);
    const results = await Promise.allSettled(enrolled.map((e) => e.rt ? e.rt.stop() : Promise.resolve({ tick: -1 } as never)));
    const ticks = results.map((r, i) => ({ id: enrolled[i].spec.id, ticks: r.status === "fulfilled" ? r.value.tick : -1 }));
    console.log(JSON.stringify({ stopped: true, projects: ticks.map((t) => t.id), ticks, status: statusPath(root), log: ticksPath(root) }));
    process.exit(0);
  }
  // FIXED (the W24 ship gate LOW): `listenerCount` was a FRAGILE guard — any other library's
  // SIGTERM listener made the daemon's stop() never wire (unkillable by signals). A
  // module-scoped flag keys on OUR registration, not the global count.
  if (!signalsWired) {
    signalsWired = true;
    process.on("SIGTERM", () => void stop().catch((e) => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); }));
    process.on("SIGINT", () => void stop().catch((e) => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); }));
  }

  await tickCycle();   // the first cycle runs NOW, not after one interval
  console.log(JSON.stringify({
    started: true, root, tickMs,
    projects: enrolled.map((e) => ({ id: e.spec.id, publisher: e.ok && !e.reason ? `ARMED:${e.spec.owner}/${e.spec.repo}` : (e.reason?.startsWith("DISARMED") ? e.reason : `NOT-ARMED:${e.reason ?? "?"}`) })),
    publisher: armed > 0 ? `ARMED:${enrolled.filter((e) => e.ok && !e.reason).map((e) => `${e.spec.owner}/${e.spec.repo}`).join(",")}` : "DISARMED:no-token",
    counts: { armed, disarmed, dark, enrolled: enrolled.length, legacy: reg.legacy },
    status: statusPath(root), log: ticksPath(root),
  }));
}

// a module must not boot a daemon on IMPORT (the test-hazard rule)
if (import.meta.main) void main();
