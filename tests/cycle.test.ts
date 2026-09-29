// cycle.test.ts — THE ORCHESTRATOR'S OWN COVERAGE (the audit's SLOP-10).
//
// THE GAP: main.ts held FOUR HIGH defects and NOT ONE of them had a test, because the cycle
// lived INSIDE main() — unreachable without booting a daemon and a live registry. The cycle is
// now `makeCycle()`; this file drives it directly. The classes this pins:
//
//   HIGH F — the disarm visibility: a DISARMED project's row must carry the REASON. main.ts's
//            own header states the law ("A DISABLED PROJECT IS NAMED EVERY CYCLE — never a
//            silent skip"), but the row dropped it, so status.json showed ok:true/errors:[]
//            for an inert project. A monitor could not see the disarm.
//   SLOP-02 — the settle-all contract: ONE project throwing must leave the OTHERS untouched,
//            the failed count must rise, and the error must land in ITS OWN row.
//   SLOP-03 — the rejection row must read the project's OWN status file (the old
//            readStatus(root) doubled the path and reported tick=0 forever).
//
// THE ADVERSARIAL CASES COME FIRST: the throw, the disarm, the empty fleet. The happy path
// is LAST.
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { makeCycle, type Enrolled } from "../src/main";
import type { ProjectSpec } from "../src/projects";
import type { Runtime } from "../src/runtime";
import { statusPath, projectStatusPath, appendTick } from "../src/status";
import type { RuntimeStatus, AggregateStatus } from "../src/status";

let root = "";
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "cycle-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

function spec(id: string): ProjectSpec {
  return { id, root, owner: "o", repo: "r", tokenEnv: "T", worktreeRoot: join(root, "wt"), store: join(root, "runtime", id, "store.sqlite") };
}

/** a fake runtime whose tick returns a fixed status (or throws). */
function rt(tick: () => Promise<RuntimeStatus>): Runtime {
  return { tick, start() {}, stop: async () => empty(), status: () => null, state: { running: false, tick: 0 } };
}

function empty(over: Partial<RuntimeStatus> = {}): RuntimeStatus {
  return { ts: "t", tick: 0, daemonOk: true, cursor: 0, prNodes: 0, ready: 0, eligible: 0,
    planHash: null, planKind: "ok", kicks: 0, errors: [], ...over };
}

function health(): RuntimeStatus {
  return empty({ prNodes: 3, ready: 2, eligible: 1, cursor: 99 });
}

function agg(): AggregateStatus {
  return JSON.parse(readFileSync(statusPath(root), "utf8")) as AggregateStatus;
}

// ═══ ADVERSARIAL 1: the THROWING project — settle-all, the others untouched ═══

test("a THROWING project lands in ITS OWN row; the healthy sibling is untouched", async () => {
  const enrolled: Enrolled[] = [
    { spec: spec("bad"), rt: rt(async () => { throw new Error("boom-xyz"); }), ok: true },
    { spec: spec("good"), rt: rt(async () => health()), ok: true },
  ];
  await makeCycle(enrolled, root, () => 1)();

  const a = agg();
  expect(a.failed).toBe(1);
  expect(a.projects.bad.ok).toBe(false);
  expect(a.projects.bad.error).toBe("Error: boom-xyz");   // String(Error) carries its name
  expect(a.projects.bad.errors.some((e) => e.startsWith("tick-threw:Error: boom-xyz"))).toBe(true);
  // the healthy sibling survived the rejection
  expect(a.projects.good.ok).toBe(true);
  expect(a.projects.good.prNodes).toBe(3);
  // the top-level error names the culprit
  expect(a.errors.some((e) => e.startsWith("bad:"))).toBe(true);
});

test("the rejection row reads the project's OWN last status (SLOP-03), not tick=0", async () => {
  // seed the project's own status file, as a prior successful tick would have
  const p = projectStatusPath(root, "bad");
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(join(root, "runtime", "bad"), { recursive: true });
  writeFileSync(p, JSON.stringify(empty({ tick: 7, cursor: 42, prNodes: 5 })));
  const enrolled: Enrolled[] = [
    { spec: spec("bad"), rt: rt(async () => { throw new Error("later-boom"); }), ok: true },
  ];
  await makeCycle(enrolled, root, () => 8)();
  const r = agg().projects.bad;
  expect(r.tick).toBe(7);    // the LAST observed tick, not 0
  expect(r.cursor).toBe(42); // the LAST observed cursor, not 0
  expect(r.prNodes).toBe(5);
});

// ═══ ADVERSARIAL 2: the DISARMED project — the reason MUST be visible (HIGH F) ═══

test("a DISARMED project's row carries the REASON — never a silent ok:true (HIGH F)", async () => {
  const enrolled: Enrolled[] = [
    { spec: spec("off"), rt: rt(async () => health()), ok: true, reason: "DISARMED:no-token" },
  ];
  await makeCycle(enrolled, root, () => 1)();

  const r = agg().projects.off;
  expect(r.ok).toBe(false);                       // was: ok:true — the bug
  expect(r.error).toBe("DISARMED:no-token");      // was: undefined — the bug
  expect(r.errors).toContain("enrolled:DISARMED:no-token"); // the row names the disarm
});

// ═══ ADVERSARIAL 3: the EMPTY-ish fleet — one entry, the aggregate still well-formed ═══

test("a single healthy project: the aggregate carries it and the fleet sum equals it", async () => {
  const enrolled: Enrolled[] = [{ spec: spec("solo"), rt: rt(async () => health()), ok: true }];
  await makeCycle(enrolled, root, () => 4)();
  const a = agg();
  expect(a.tick).toBe(4);
  expect(a.ready).toBe(2);
  expect(a.eligible).toBe(1);
  expect(a.prNodes).toBe(3);
  expect(a.daemonOk).toBe(true);
  expect(a.failed).toBe(0);
  expect(Object.keys(a.projects)).toEqual(["solo"]);
});

test("the fleet sum adds every project's numbers", async () => {
  const enrolled: Enrolled[] = [
    { spec: spec("a"), rt: rt(async () => empty({ prNodes: 1, ready: 1, eligible: 0 })), ok: true },
    { spec: spec("b"), rt: rt(async () => empty({ prNodes: 2, ready: 1, eligible: 1 })), ok: true },
  ];
  await makeCycle(enrolled, root, () => 1)();
  const a = agg();
  expect(a.prNodes).toBe(3);
  expect(a.ready).toBe(2);
  expect(a.eligible).toBe(1);
});

// ═══ THE CONTRACT: each cycle appends ONE tick row ═══

test("each cycle appends exactly one fleet tick row", async () => {
  const enrolled: Enrolled[] = [{ spec: spec("solo"), rt: rt(async () => health()), ok: true }];
  const cycle = makeCycle(enrolled, root, (() => { let n = 0; return () => ++n; })());
  await cycle();
  await cycle();
  await cycle();
  const log = readFileSync(join(root, "runtime", "ticks.log"), "utf8").trim().split("\n");
  expect(log.length).toBe(3);
  // the fleet tick log line: "<ts> tick=N daemonOk=... cursor=... prNodes=... planKind=... errors=..."
  expect(log[2]).toContain("tick=3");
  expect(log[2]).toContain("daemonOk=true");
});

// ═══ THE HAPPY PATH LAST ═══

test("the happy path: all healthy, daemonOk true, no failures", async () => {
  const enrolled: Enrolled[] = [
    { spec: spec("a"), rt: rt(async () => health()), ok: true },
    { spec: spec("b"), rt: rt(async () => empty({ daemonOk: true, planKind: "ok" })), ok: true },
  ];
  await makeCycle(enrolled, root, () => 1)();
  const a = agg();
  expect(a.daemonOk).toBe(true);
  expect(a.failed).toBe(0);
  expect(a.errors).toEqual([]);
  expect(a.planKind).toBe("ok");
  expect(existsSync(statusPath(root))).toBe(true);
});

test("a project with ok:false (ENROLL-FAILED) is rejected without calling its runtime", async () => {
  let called = false;
  const enrolled: Enrolled[] = [
    { spec: spec("dark"), rt: { tick: async () => { called = true; return empty(); }, start() {}, stop: async () => empty(), status: () => null, state: { running: false, tick: 0 } }, ok: false, reason: "ENROLL-FAILED:no-db" },
  ];
  await makeCycle(enrolled, root, () => 1)();
  expect(called).toBe(false);             // the runtime is never entered
  expect(agg().projects.dark.ok).toBe(false);
  expect(agg().failed).toBe(1);
});
