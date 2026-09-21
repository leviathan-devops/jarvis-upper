// W2 gate: all-green allows; missing gate blocks; sha flip blocks STALE.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { openStore } from "../src/store";
import { guardrail } from "../src/guardrail";

function mem(): Database {
  const db = openStore(":memory:");
  db.exec("DELETE FROM pr_node; DELETE FROM pr_edge; DELETE FROM gate_pass;");
  return db;
}
function fullGreen(db: Database, id: string, sha: string | null): void {
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, head_sha, state) VALUES (?, 'p', 1, 's', ?, 'ready_to_merge')")
    .run(id, sha);
  for (const g of ["ci_green", "audit", "hardened", "fence2"]) {
    db.query("INSERT INTO gate_pass(id, pr_node, gate, verdict, sha16, at) VALUES (?,?,?,?,?,0)")
      .run(`${id}:${g}`, id, g, "pass", sha);
  }
}

test("guardrail_blocks_stale: all green + matching sha allows", () => {
  const db = mem();
  fullGreen(db, "g1", "abc");
  const e = guardrail(db, "g1");
  expect(e.ok).toBe(true);
  expect(e.reasons).toEqual([]);
  db.close();
});

test("guardrail_blocks_stale: missing gate blocks with name", () => {
  const db = mem();
  fullGreen(db, "g2", "abc");
  db.query("DELETE FROM gate_pass WHERE pr_node='g2' AND gate='audit'").run();
  const e = guardrail(db, "g2");
  expect(e.ok).toBe(false);
  expect(e.reasons).toContain("GATE-MISSING:audit");
  db.close();
});

test("guardrail_blocks_stale: sha flip after gate blocks STALE-GATE", () => {
  const db = mem();
  fullGreen(db, "g3", "abc");
  db.query("UPDATE pr_node SET head_sha='zzz' WHERE id='g3'").run();
  const e = guardrail(db, "g3");
  expect(e.ok).toBe(false);
  expect(e.reasons.some((r) => r.startsWith("STALE-GATE:"))).toBe(true);
  db.close();
});

test("guardrail_blocks_stale: unmerged dep blocks with name", () => {
  const db = mem();
  fullGreen(db, "g4", "abc");
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, state) VALUES ('dep','p',2,'s','open')").run();
  db.query("INSERT INTO pr_edge(id, from_pr, to_pr, kind, created_at) VALUES ('dep>g4','dep','g4','depends_on',0)").run();
  const e = guardrail(db, "g4");
  expect(e.ok).toBe(false);
  expect(e.reasons).toContain("DEP-UNMERGED:dep");
  db.close();
});

test("guardrail_blocks_stale: unknown PR is a hard block", () => {
  const db = mem();
  const e = guardrail(db, "ghost");
  expect(e.ok).toBe(false);
  expect(e.reasons).toContain("PR-MISSING");
  db.close();
});
