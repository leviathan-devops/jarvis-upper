// W1 gate — `bun test -t runtime_ticks`
// The loop owns time, survives a daemon outage, and RESUMES (cursor kept).
// Adversarial first: the DOWN tick is exercised before the happy path.
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime } from "../src/runtime";
import { openStore } from "../src/store";
import { tickRowCount, readStatus } from "../src/status";
import type { PrRow } from "../src/sync";

function seededDb(root: string) {
  const db = openStore(":memory:");
  const pr: PrRow = { project: "p", pr_number: 1, session_id: "s-1", head_sha: "h1", state: "ready_to_merge" };
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, head_sha, state) VALUES ('pr:s-1:1','p',1,'s-1','h1','ready_to_merge')").run();
  for (const g of ["ci_green", "audit", "hardened", "fence2"]) {
    db.query("INSERT INTO gate_pass(id, pr_node, gate, verdict, sha16, at) VALUES (?,?,?,?,?,0)")
      .run(`pr:s-1:1:${g}`, "pr:s-1:1", g, "pass", "h1");
  }
  return { db, pr };
}

test("runtime_ticks: DOWN daemon is the first exercise — daemonOk false, error named", async () => {
  const root = mkdtempSync(join(tmpdir(), "rt-down-"));
  const { db } = seededDb(root);
  let up = false;
  const rt = createRuntime({ root, db, deps: { probe: async () => up, listPrs: async () => [], rails: async () => ({ frames: 0, bytes: 0, lastSeq: 0 }) } });
  const s = await rt.tick();
  expect(s.daemonOk).toBe(false);
  expect(s.errors).toContain("ECONNREFUSED");
  expect(tickRowCount(root)).toBe(1);
  rmSync(root, { recursive: true, force: true });
});

test("runtime_ticks: with the daemon UP rows accumulate and status carries the plan", async () => {
  const root = mkdtempSync(join(tmpdir(), "rt-up-"));
  const { db, pr } = seededDb(root);
  let up = true;
  const rt = createRuntime({
    root, db,
    deps: { probe: async () => up, listPrs: async () => [pr], rails: async () => ({ frames: 3, bytes: 900, lastSeq: 3 }) },
  });
  await rt.tick();
  const s2 = await rt.tick();
  expect(tickRowCount(root)).toBeGreaterThanOrEqual(2);
  expect(s2.daemonOk).toBe(true);
  expect(s2.prNodes).toBe(1);
  expect(s2.ready).toBe(1);
  expect(s2.eligible).toBe(1);
  expect(s2.planKind).toBe("ok");
  expect(s2.planHash).not.toBeNull();
  expect(s2.errors).toEqual([]);
  rmSync(root, { recursive: true, force: true });
});

test("runtime_ticks: outage flips daemonOk false, recovery flips true, cursor kept (resume)", async () => {
  const root = mkdtempSync(join(tmpdir(), "rt-flip-"));
  const { db, pr } = seededDb(root);
  let up = true;
  const rt = createRuntime({ root, db, deps: { probe: async () => up, listPrs: async () => [pr], rails: async () => ({ frames: 2, bytes: 600, lastSeq: 2 }) } });
  await rt.tick();
  db.query("INSERT INTO rail_seq(source, last_seq, updated_at) VALUES ('ao-events', 42, 0) ON CONFLICT(source) DO UPDATE SET last_seq=42").run();
  up = false;
  const down = await rt.tick();
  expect(down.daemonOk).toBe(false);
  expect(down.cursor).toBe(42);
  up = true;
  const back = await rt.tick();
  expect(back.daemonOk).toBe(true);
  expect(back.cursor).toBe(42);
  const rows = readFileSync(join(root, "runtime/ticks.log"), "utf8").split("\n").filter((l) => l.trim());
  expect(rows.length).toBe(3);
  expect(rows[1]).toContain("daemonOk=false");
  expect(rows[2]).toContain("daemonOk=true");
  rmSync(root, { recursive: true, force: true });
});

test("runtime_ticks: status.json is written atomically and readable", async () => {
  const root = mkdtempSync(join(tmpdir(), "rt-json-"));
  const { db } = seededDb(root);
  const rt = createRuntime({ root, db, deps: { probe: async () => false, listPrs: async () => [], rails: async () => ({ frames: 0, bytes: 0, lastSeq: 0 }) } });
  await rt.tick();
  expect(existsSync(join(root, "runtime/status.json"))).toBe(true);
  const s = readStatus(root);
  expect(s).not.toBeNull();
  expect(s!.tick).toBe(1);
  rmSync(root, { recursive: true, force: true });
});
