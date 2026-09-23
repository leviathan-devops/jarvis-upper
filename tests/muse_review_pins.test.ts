// muse_review_pins.test.ts — the pins for the three HIGH findings from the
// INDEPENDENT zero-context review (muse exec --reasoning-effort xhigh). Each pin
// goes RED if the fix is reverted.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { openStore } from "../src/store";
import { guardrail, recordGatePass } from "../src/guardrail";
import { reduceEvent } from "../src/reducers";
import { REQUIRED_CONTEXTS } from "../src/status-contract";

const ALL_GREEN: Record<string, string> = Object.fromEntries(REQUIRED_CONTEXTS.map((c) => [c, "success"]));

test("muse-2: a NULL gate_pass.head_sha is STALE (fail-closed), not a free pass", () => {
  const db = openStore(":memory:");
  db.query("INSERT INTO pr_node(id,project,pr_number,session_id,head_sha,state) VALUES ('p','x',1,'s','aaa','ready_to_merge')").run();
  // a row with a NULL head_sha = an UNKNOWN-COMMIT gate
  for (const g of ["ci_green", "audit", "hardened", "fence2"]) {
    db.query("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES (?,?,?,?,NULL,0)").run(`p:${g}`, "p", g, "pass");
  }
  const e = guardrail(db, "p");
  expect(e.ok).toBe(false);                                   // must NOT authorize
  expect(e.reasons.filter((r) => r.startsWith("STALE-GATE:")).length).toBe(4);
  db.close();
});

test("muse-2: recordGatePass writes a real head_sha, so a matching head ALLOWS", () => {
  const db = openStore(":memory:");
  db.query("INSERT INTO pr_node(id,project,pr_number,session_id,head_sha,state) VALUES ('q','x',1,'s','abc','ready_to_merge')").run();
  recordGatePass(db, "q", "abc", ALL_GREEN);
  expect(guardrail(db, "q").ok).toBe(true);
  db.query("UPDATE pr_node SET head_sha='zzz' WHERE id='q'").run();
  expect(guardrail(db, "q").reasons.some((r) => r.startsWith("STALE-GATE:"))).toBe(true);
  db.close();
});

test("muse-3: an out-of-vocabulary state does NOT throw (no head-of-line block)", () => {
  const db = openStore(":memory:");
  const ev = { type: "pr_state_changed", seq: 1, data: { pr: { number: 5, state: "TOTALLY_BOGUS" }, sessionId: "s1", projectId: "p" } };
  // must NOT throw (the old code violated the CHECK and threw inside attach)
  const outcome = reduceEvent(db, ev as never);
  expect(outcome).toBe("cursor-only");
  const row = db.query("SELECT COUNT(*) AS n FROM pr_node").get() as { n: number };
  expect(row.n).toBe(0);   // the malformed event was not applied
  db.close();
});

test("muse-3: a VALID state still applies", () => {
  const db = openStore(":memory:");
  const ev = { type: "pr_state_changed", seq: 2, data: { pr: { number: 6, state: "ready_to_merge" }, sessionId: "s1", projectId: "p" } };
  expect(reduceEvent(db, ev as never)).toBe("applied");
  const row = db.query("SELECT state FROM pr_node WHERE id='pr:s1:6'").get() as { state: string };
  expect(row.state).toBe("ready_to_merge");
  db.close();
});
