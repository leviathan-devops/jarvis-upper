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
interface Enrolled { spec: ProjectSpec; rt: Runtime; ok: boolean; reason?: string; }

let signalsWired = false;   // FIXED: our OWN registration flag, not the global listener count
let orchestratorStarted = false;

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
  let cycle = 0;
  const tickCycle = async (): Promise<void> => {
    cycle += 1;
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
        rows[e.spec.id] = { ...r.value, ok: e.ok };
      } else {
        // A REJECTED project is LOUD and CONTAINED: its row carries the error, the count
        // rises, and the other projects are untouched.
        failed += 1;
        errors.push(`${e.spec.id}:${String(r.reason).slice(0, 120)}`);
        // FIXED (the audit SLOP-03): readStatus(root) joins `runtime/status.json` onto its
        // argument, so `${root}/runtime/${id}` resolved to `<root>/runtime/<id>/runtime/status.json`
        // which NEVER exists — every rejection row reported tick=0/cursor=0. Read the project's
        // own status file directly.
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
    // the top-level numbers are the FLEET SUM — the old shape keeps working.
    const all = Object.values(rows);
    const sum = (f: (r: ProjectStatusRow) => number) => all.reduce((a, r) => a + f(r), 0);
    writeAggregate(root, {
      ts: new Date().toISOString(), tick: cycle,
      daemonOk: all.length > 0 && all.every((r) => r.daemonOk),
      cursor: Math.max(0, ...all.map((r) => r.cursor)),
      prNodes: sum((r) => r.prNodes), ready: sum((r) => r.ready), eligible: sum((r) => r.eligible),
      planHash: all.length === 1 ? all[0].planHash : null,
      planKind: all.length > 0 && all.every((r) => r.planKind === "ok") ? "ok" : "none",
      kicks: sum((r) => r.kicks), errors,
      projects: rows, failed,
    });
    // THE FLEET TICK LOG: the per-project logs are authoritative; this top-level row keeps the
    // legacy reader (tickRowCount/ticksPath) and the drift sweep working on the fleet as a whole.
    appendTick(root, { ts: new Date().toISOString(), tick: cycle,
      daemonOk: all.length > 0 && all.every((r) => r.daemonOk), cursor: Math.max(0, ...all.map((r) => r.cursor)),
      prNodes: sum((r) => r.prNodes), ready: sum((r) => r.ready), eligible: sum((r) => r.eligible),
      // FIXED (the audit SLOP-04): hardcoded planKind:"ok" made the log the legacy reader,
      // the drift sweep and the host heartbeat read report a GREEN PLAN in the very cycle the
      // only project was DARK and failed (daemonOk=false + planKind=ok in ONE row). Derived.
      planHash: null,
      planKind: all.length > 0 && all.every((r) => r.planKind === "ok") ? "ok" : "none",
      kicks: sum((r) => r.kicks), errors });
  };

  const timer = setInterval(() => void tickCycle().catch((e) => console.error(`cycle-threw:${String(e).slice(0, 120)}`)), tickMs);

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

  orchestratorStarted = true;
  await tickCycle();   // the first cycle runs NOW, not after one interval
  console.log(JSON.stringify({
    started: true, root, tickMs,
    projects: enrolled.map((e) => ({ id: e.spec.id, publisher: e.ok && !e.reason ? `ARMED:${e.spec.owner}/${e.spec.repo}` : (e.reason?.startsWith("DISARMED") ? e.reason : `NOT-ARMED:${e.reason ?? "?"}`) })),
    publisher: armed > 0 ? `ARMED:${enrolled.filter((e) => e.ok && !e.reason).map((e) => `${e.spec.owner}/${e.spec.repo}`).join(",")}` : "DISARMED:no-token",
    counts: { armed, disarmed, dark, enrolled: enrolled.length, legacy: reg.legacy },
    status: statusPath(root), log: ticksPath(root),
  }));
}

/** Test/`import`-safety probe: has the orchestrator booted in THIS process? */
export function isStarted(): boolean { return orchestratorStarted; }

// a module must not boot a daemon on IMPORT (the test-hazard rule)
if (import.meta.main) void main();
