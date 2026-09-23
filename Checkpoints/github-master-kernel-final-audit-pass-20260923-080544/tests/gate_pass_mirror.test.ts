// gate_pass_mirror.test.ts — the pin for the ocr final HIGH ("the local gate_pass
// mirror has no populator, so head_sha is always NULL and STALE-GATE can never
// fire"). This drives recordGatePass (the runtime's mirror sync) and asserts the
// staleness check is now FUNCTIONAL: all-green at head X allows; a head move to Y
// then fires STALE-GATE.
import { test, expect } from "bun:test";
import { openStore } from "../src/store";
import { guardrail, recordGatePass } from "../src/guardrail";
import { REQUIRED_CONTEXTS } from "../src/status-contract";

const ALL_GREEN: Record<string, string> = Object.fromEntries(REQUIRED_CONTEXTS.map((c) => [c, "success"]));

test("gate_pass_mirror: the mirror populates the rows, so STALE-GATE can FIRE", () => {
  const db = openStore(":memory:");
  db.query("INSERT INTO pr_node(id,project,pr_number,session_id,head_sha,state) VALUES ('p','x',1,'s','abc','ready_to_merge')").run();
  recordGatePass(db, "p", "abc", ALL_GREEN);
  // the mirror wrote all 4 internal gates at head 'abc'
  const rows = db.query("SELECT gate, verdict, head_sha FROM gate_pass WHERE pr_node='p'").all() as { gate: string; verdict: string; head_sha: string }[];
  expect(rows.length).toBe(4);
  expect(rows.every((r) => r.verdict === "pass" && r.head_sha === "abc")).toBe(true);
  // all green at the SAME head -> eligible
  expect(guardrail(db, "p").ok).toBe(true);
  // the PR head moves -> the check now FIRES (the finding said it never could)
  db.query("UPDATE pr_node SET head_sha='zzz' WHERE id='p'").run();
  const e = guardrail(db, "p");
  expect(e.ok).toBe(false);
  expect(e.reasons.some((r) => r.startsWith("STALE-GATE:"))).toBe(true);
  db.close();
});

test("gate_pass_mirror: a MISSING remote context is not green", () => {
  const db = openStore(":memory:");
  db.query("INSERT INTO pr_node(id,project,pr_number,session_id,head_sha,state) VALUES ('q','x',1,'s','abc','ready_to_merge')").run();
  const partial = { ...ALL_GREEN };
  delete (partial as Record<string, string>)["gates/test"]; // one job never posted
  recordGatePass(db, "q", "abc", partial);
  const e = guardrail(db, "q");
  expect(e.ok).toBe(false); // ci_green folds the 6 jobs; one missing -> not green
  db.close();
});
