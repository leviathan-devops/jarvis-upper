// latch.test.ts — THE SELF-LATCH BREAK, proven both ways.
//
// THE DEFECT (measured live): the publisher was gated on the FULL guardrail, which includes
// the gates the factory ITSELF publishes. The tick mirrors those back before the read, so ONE
// transient failure (a SIGTERMed fence -> exit 143) permanently disabled the publisher — the
// daemon could never clear the red it had published. A real PR carries that false red today.
//
// THE LAW: a publisher gates on its INPUTS, never on its OUTPUTS.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { guardrail, publishEligible } from "../src/guardrail";
import { GATE_TO_CONTEXT, EXTERNAL_GATES, OWN_GATES } from "../src/status-contract";

function db(): Database {
  const d = new Database(":memory:");
  d.run("CREATE TABLE pr_node(id TEXT PRIMARY KEY, state TEXT, head_sha TEXT)");
  d.run("CREATE TABLE gate_pass(id TEXT PRIMARY KEY, pr_node TEXT, gate TEXT, verdict TEXT, head_sha TEXT, at INTEGER)");
  d.run("CREATE TABLE pr_edge(from_pr TEXT, to_pr TEXT, kind TEXT)");
  d.run("INSERT INTO pr_node VALUES('p','ready_to_merge','sha1')");
  return d;
}
const setGate = (d: Database, g: string, v: string) =>
  d.run("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES(?,?,?,?,?,?)", [`${g}`, "p", g, v, "sha1", 100]);

test("test_the_gate_split_is_derived_not_hand_listed", () => {
  // EXTERNAL = every context is a GitHub Actions job (the factory READS it).
  // OWN      = at least one context is a factory/* status (the factory PRODUCES it).
  for (const g of EXTERNAL_GATES) {
    for (const c of GATE_TO_CONTEXT[g] as readonly string[]) expect(c.startsWith("gates/")).toBe(true);
  }
  for (const g of OWN_GATES) {
    expect((GATE_TO_CONTEXT[g] as readonly string[]).some((c) => c.startsWith("factory/"))).toBe(true);
  }
  // the live split: ci_green is READ; audit/hardened/fence2 are PRODUCED
  expect(EXTERNAL_GATES).toEqual(["ci_green"]);
  expect(OWN_GATES.sort()).toEqual(["audit", "fence2", "hardened"]);
});

test("test_a_failed_OWN_gate_does_not_disable_the_publisher", () => {
  // THE POSITIVE CONTROL for the latch break. All EXTERNAL gates green; the factory's OWN
  // three gates FAILED (the live state: audit/hardened/fence2 = fail, ci_green = pass).
  const d = db();
  setGate(d, "ci_green", "pass");
  for (const g of OWN_GATES) setGate(d, g, "fail");
  // the PUBLISHER must still be eligible — otherwise the correction can never go out
  const pub = publishEligible(d, "p");
  expect(pub.ok).toBe(true);
  expect(pub.reasons).toEqual([]);
  // ...and the MERGE path must still REFUSE (a failed verdict cannot merge)
  const merge = guardrail(d, "p");
  expect(merge.ok).toBe(false);
  // FIXED (the audit MEDIUM K): a PRESENT-but-FAILED gate is GATE-FAILED, not GATE-MISSING.
  expect(merge.reasons.join("|")).toContain("GATE-FAILED:fence2:fail");
});

test("test_the_missing_vs_failed_gates_are_distinct (the audit MEDIUM K)", () => {
  // THE ONE BRANCH THIS SPLITS: an ABSENT gate is GATE-MISSING; a PRESENT-BUT-FAILED gate is
  // GATE-FAILED. Before the fix one branch named both GATE-MISSING, so a substantive red read
  // as "missing" — the operator could not tell a gate that never ran from one that failed.
  const miss = db();                         // no gate_pass rows at all
  expect(guardrail(miss, "p").reasons.join("|")).toContain("GATE-MISSING:ci_green");
  const failed = db(); setGate(failed, "ci_green", "fail");
  expect(guardrail(failed, "p").reasons.join("|")).toContain("GATE-FAILED:ci_green:fail");
  expect(guardrail(failed, "p").reasons.join("|")).not.toContain("GATE-MISSING:ci_green");
});

test("test_a_failed_EXTERNAL_gate_disables_the_publisher", () => {
  // the converse: a red GitHub Actions job is a REAL input — the factory must not certify it.
  const d = db();
  setGate(d, "ci_green", "fail");
  for (const g of OWN_GATES) setGate(d, g, "pass");
  const pub = publishEligible(d, "p");
  expect(pub.ok).toBe(false);
  // FIXED (the audit MEDIUM K): a present-but-failed external gate is GATE-FAILED.
  expect(pub.reasons.join("|")).toContain("GATE-FAILED:ci_green:fail");
});

test("test_the_external_check_keeps_the_sha_binding", () => {
  // a stale external gate (a head that moved) must still block the publisher
  const d = db();
  d.run("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES('cg','p','ci_green','pass','OLD_SHA',100)");
  const pub = publishEligible(d, "p");
  expect(pub.ok).toBe(false);
  expect(pub.reasons.join("|")).toContain("STALE-GATE:ci_green");
});
