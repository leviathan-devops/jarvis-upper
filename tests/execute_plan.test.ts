// W5 gate: order ONLY via executePlan+confirm; mid-plan failure halts.
// INVERSION (Plan A-3): the factory orders + publishes; the human merges.
// Proof: after a successful run every PR is "merge_ordered", never "merged".
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { openStore } from "../src/store";
import { executePlan } from "../src/execute";

function mem(): Database {
  const db = openStore(":memory:");
  db.exec("DELETE FROM pr_node; DELETE FROM pr_edge; DELETE FROM gate_pass;");
  return db;
}
function green(db: Database, id: string): void {
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, head_sha, state) VALUES (?, 'p', 1, 's', 'h', 'ready_to_merge')").run(id);
  for (const g of ["ci_green", "audit", "hardened", "fence2"]) {
    db.query("INSERT INTO gate_pass(id, pr_node, gate, verdict, head_sha, at) VALUES (?,?,?,?,?,0)").run(`${id}:${g}`, id, g, "pass", "h");
  }
}

test("execute_plan: no confirm refuses before touching anything", async () => {
  const db = mem();
  green(db, "a");
  let calls = 0;
  let err = "";
  try {
    await executePlan(db, { publish: async () => { calls++; return { ok: true }; } }, { confirm: false });
  } catch (e) { err = String(e); }
  expect(err.includes("UNCONFIRMED-PLAN")).toBe(true);
  expect(calls).toBe(0);
  db.close();
});

test("execute_plan: confirm orders in topo order and lands merge_ordered", async () => {
  const db = mem();
  green(db, "x"); green(db, "y");
  db.query("INSERT INTO pr_edge(id, from_pr, to_pr, kind, created_at) VALUES ('x>y','x','y','depends_on',0)").run();
  const order: string[] = [];
  const r = await executePlan(db, { publish: async (p: string) => { order.push(p); return { ok: true }; } }, { confirm: true });
  expect(order).toEqual(["x", "y"]);
  expect(r.merged).toEqual(["x", "y"]);
  expect(r.haltedAt).toBeNull();
  const states = db.query("SELECT id, state FROM pr_node ORDER BY id").all() as { id: string; state: string }[];
  expect(states).toEqual([
    { id: "x", state: "merge_ordered" },
    { id: "y", state: "merge_ordered" },
  ]);
  db.close();
});

test("execute_plan: mid-plan adapter failure halts, partial recorded", async () => {
  const db = mem();
  green(db, "m1"); green(db, "m2");
  const order: string[] = [];
  const r = await executePlan(db, {
    publish: async (p: string) => { order.push(p); return { ok: p !== "m2" }; },
  }, { confirm: true });
  expect(order).toEqual(["m1", "m2"]);
  expect(r.merged).toEqual(["m1"]);
  expect(r.haltedAt).toBe("m2");
  expect(r.haltReason).toBe("PUBLISH-CALL-FAILED");
  const st = db.query("SELECT state FROM pr_node WHERE id='m1'").get() as { state: string };
  expect(st.state).toBe("merge_ordered");
  const st2 = db.query("SELECT state FROM pr_node WHERE id='m2'").get() as { state: string };
  expect(st2.state).toBe("ready_to_merge");
  db.close();
});
