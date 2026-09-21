// W2 gate: topo order emits plan; cycle fixture refuses CYCLE, zero merges.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { openStore } from "../src/store";
import { orderMerges } from "../src/plan";

function mem(): Database {
  const db = openStore(":memory:");
  db.exec("DELETE FROM pr_node; DELETE FROM pr_edge;");
  return db;
}
const node = (db: Database, id: string, state = "ready_to_merge") =>
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, state) VALUES (?, 'p', 1, 's', ?)")
    .run(id, state);
const edge = (db: Database, f: string, t: string) =>
  db.query("INSERT INTO pr_edge(id, from_pr, to_pr, kind, created_at) VALUES (?,?,?,'depends_on',0)")
    .run(`${f}>${t}`, f, t);

test("planner_cycle: diamond orders deps first", () => {
  const db = mem();
  node(db, "a"); node(db, "b"); node(db, "c"); node(db, "d");
  edge(db, "a", "b"); edge(db, "a", "c"); edge(db, "b", "d"); edge(db, "c", "d");
  const v = orderMerges(db);
  if (v.kind !== "ok") throw new Error("expected ok");
  expect(v.order[0]).toBe("a");
  expect(v.order[3]).toBe("d");
  expect(v.order.length).toBe(4);
  db.close();
});

test("planner_cycle: cycle fixture refuses CYCLE with member nodes", () => {
  const db = mem();
  node(db, "x"); node(db, "y"); node(db, "z"); node(db, "clean");
  edge(db, "x", "y"); edge(db, "y", "z"); edge(db, "z", "x");
  const v = orderMerges(db);
  if (v.kind !== "cycle") throw new Error("expected cycle, got ok — FORGED PLAN");
  expect(v.nodes).toEqual(["x", "y", "z"]);
  db.close();
});

test("planner_cycle: non-ready nodes excluded, ready still ordered", () => {
  const db = mem();
  node(db, "m", "merged"); node(db, "r"); node(db, "o", "open");
  const v = orderMerges(db);
  if (v.kind !== "ok") throw new Error("expected ok");
  expect(v.order).toEqual(["r"]);
  db.close();
});
