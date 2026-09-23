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

test("muse2-1: a NULL PR head_sha is STALE (both sides must be KNOWN)", () => {
  const db = openStore(":memory:");
  db.query("INSERT INTO pr_node(id,project,pr_number,session_id,head_sha,state) VALUES ('r','x',1,'s',NULL,'ready_to_merge')").run();
  for (const g of ["ci_green", "audit", "hardened", "fence2"]) {
    db.query("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES (?,?,?,?,?,0)").run(`r:${g}`, "r", g, "pass", "abc");
  }
  const e = guardrail(db, "r");
  expect(e.ok).toBe(false);                                    // unknown current must block
  expect(e.reasons.filter((x) => x.startsWith("STALE-GATE:")).length).toBe(4);
  db.close();
});

test("muse2-2: a missing PR state does NOT throw the store CHECK (no batch rollback)", async () => {
  const db = openStore(":memory:");
  const { listPrsFromAo } = await import("../src/adapter-verbs");
  // a payload with NO state -> must map to a VALID vocabulary member, not "unknown"
  const fakeCall = async (method: string) => {
    if (method === "listSessions") return { sessions: [{ id: "s1", projectId: "p" }] };
    if (method === "listSessionPRs") return { sessionId: "s1", prs: [{ number: 7, headSha: "h" }] };
    return null;
  };
  const rows = await listPrsFromAo({ callFn: fakeCall as never });
  expect(rows.length).toBe(1);
  expect(rows[0].state).toBe("open");                          // a VALID state
  // and the row inserts without a CHECK violation
  expect(() => db.query("INSERT INTO pr_node(id,project,pr_number,session_id,head_sha,state) VALUES (?,?,?,?,?,?)")
    .run(`pr:s1:7`, rows[0].project, rows[0].pr_number, rows[0].session_id, rows[0].head_sha, rows[0].state)).not.toThrow();
  db.close();
});

test("muse3-1: upsertPr must NOT erase a known sha/branch with a null incoming value", async () => {
  const db = openStore(":memory:");
  const { upsertPr } = await import("../src/sync");
  const base: any = { project:"p", pr_number:1, session_id:"s", head_sha:"abc",
    base_sha:"b1", source_branch:"feat1", target_branch:"main", state:"open", worker_hint:"w1" };
  upsertPr(db, base);
  upsertPr(db, { ...base, head_sha: null, source_branch: null });   // nulls = UNKNOWN
  const r = db.query("SELECT head_sha,base_sha,source_branch,target_branch,worker_hint FROM pr_node WHERE id='pr:s:1'").get() as any;
  expect(r.head_sha).toBe("abc");            // preserved (COALESCE)
  expect(r.source_branch).toBe("feat1");
  expect(r.worker_hint).toBe("w1");
  upsertPr(db, { ...base, head_sha: "def", source_branch: "feat2" });   // real values UPDATE
  const r2 = db.query("SELECT head_sha,source_branch FROM pr_node WHERE id='pr:s:1'").get() as any;
  expect(r2.head_sha).toBe("def");
  expect(r2.source_branch).toBe("feat2");
  db.close();
});
