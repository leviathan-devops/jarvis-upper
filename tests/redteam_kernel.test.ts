// redteam_kernel.test.ts — the red-team pressure-test corpus for the kernel's
// decision surface. Each probe is POSITIVE (the attack must block) or NEGATIVE
// (the legit op must pass). Every probe names its contract.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { openStore } from "../src/store";
import { guardrail, guardrailRemote, recordGatePass } from "../src/guardrail";
import { dossierDir } from "../src/dossier";

import { orderMerges } from "../src/plan";
import { reduceEvent } from "../src/reducers";
import { REQUIRED_CONTEXTS } from "../src/status-contract";

const GREEN = Object.fromEntries(REQUIRED_CONTEXTS.map((c) => [c, "success"]));
const readyDb = (head: string | null) => {
  const db = openStore(":memory:");
  db.query("INSERT INTO pr_node(id,project,pr_number,session_id,head_sha,state) VALUES ('p','x',1,'s',?, 'ready_to_merge')").run(head);
  return db;
};

// ---- POSITIVE: the attacks the guardrail exists to catch ----
test("RT-P1: a PR whose gates are MISSING blocks", () => {
  const db = readyDb("abc"); recordGatePass(db, "p", "abc", {} as never);
  const e = guardrail(db, "p");
  expect(e.ok).toBe(false);
  expect(e.reasons.filter((r) => r.startsWith("GATE-MISSING:")).length).toBeGreaterThan(0);
});
test("RT-P2: a RED gate blocks", () => {
  const db = readyDb("abc");
  const red = { ...GREEN, "factory/verdict": "failure" };
  recordGatePass(db, "p", "abc", red);
  expect(guardrail(db, "p").ok).toBe(false);
});
test("RT-P3: an UNMERGED dependency blocks", () => {
  const db = readyDb("abc"); recordGatePass(db, "p", "abc", GREEN);
  db.query("INSERT INTO pr_node(id,project,pr_number,session_id,state) VALUES ('dep','x',2,'s','open')").run();
  db.query("INSERT INTO pr_edge(id,from_pr,to_pr,kind,created_at) VALUES ('dep>p','dep','p','depends_on',0)").run();
  expect(guardrail(db, "p").reasons).toContain("DEP-UNMERGED:dep");
});
test("RT-P4: a STALE gate (head moved) blocks", () => {
  const db = readyDb("abc"); recordGatePass(db, "p", "abc", GREEN);
  db.query("UPDATE pr_node SET head_sha='zzz' WHERE id='p'").run();
  expect(guardrail(db, "p").reasons.some((r) => r.startsWith("STALE-GATE:"))).toBe(true);
});
test("RT-P5: an unknown commit (NULL gate head) blocks", () => {
  const db = readyDb("abc");
  for (const g of ["ci_green", "audit", "hardened", "fence2"]) {
    db.query("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES (?,?,?,?,NULL,0)").run(`p:${g}`, "p", g, "pass");
  }
  expect(guardrail(db, "p").ok).toBe(false);
});
test("RT-P6: an unknown CURRENT head (NULL pr head) blocks", () => {
  const db = readyDb(null); recordGatePass(db, "p", "abc", GREEN);
  expect(guardrail(db, "p").ok).toBe(false);
});

// ---- NEGATIVE: the legit op must NOT misfire ----
test("RT-N1: all-green at the same head ALLOWS", () => {
  const db = readyDb("abc"); recordGatePass(db, "p", "abc", GREEN);
  expect(guardrail(db, "p").ok).toBe(true);
});
test("RT-N2: a MERGED dependency allows", () => {
  const db = readyDb("abc"); recordGatePass(db, "p", "abc", GREEN);
  db.query("INSERT INTO pr_node(id,project,pr_number,session_id,state) VALUES ('dep','x',2,'s','merged')").run();
  db.query("INSERT INTO pr_edge(id,from_pr,to_pr,kind,created_at) VALUES ('dep>p','dep','p','depends_on',0)").run();
  expect(guardrail(db, "p").ok).toBe(true);
});

// ---- EDGE: the traversal family (every form) ----
test("RT-E1: the traversal family is refused (dossierDir + assertSegment)", () => {
  for (const bad of ["../x", "a/b", "..", "a\\b", "", "a\u0000b"]) {
    expect(() => dossierDir("/tmp/r", bad)).toThrow();
    
  }
});
test("RT-E2: a well-formed id resolves inside the root", () => {
  expect(dossierDir("/tmp/r", "BUG-1").startsWith("/tmp/r/dossiers/")).toBe(true);
  
});

// ---- EDGE: the planner (cycle + external dep) ----
test("RT-E3: a cycle is refused, never partially ordered", () => {
  const db = openStore(":memory:");
  for (const id of ["a", "b"]) db.query("INSERT INTO pr_node(id,project,pr_number,session_id,state) VALUES (?, 'x', 1, 's', 'ready_to_merge')").run(id);
  db.query("INSERT INTO pr_edge(id,from_pr,to_pr,kind,created_at) VALUES ('a>b','a','b','depends_on',0),('b>a','b','a','depends_on',1)").run();
  const p = orderMerges(db);
  expect(p.kind).toBe("cycle");
});
test("RT-E4: a linear chain orders dependency-first", () => {
  const db = openStore(":memory:");
  for (const id of ["a", "b"]) db.query("INSERT INTO pr_node(id,project,pr_number,session_id,state) VALUES (?, 'x', 1, 's','ready_to_merge')").run(id);
  db.query("INSERT INTO pr_edge(id,from_pr,to_pr,kind,created_at) VALUES ('b>a','b','a','depends_on',0)").run();
  const p = orderMerges(db);
  expect(p.kind).toBe("ok");
  if (p.kind === "ok") expect(p.order.indexOf("b")).toBeLessThan(p.order.indexOf("a"));
});

// ---- EDGE: the reducer (every malformed shape) ----
test("RT-E5: malformed events never throw and never corrupt", () => {
  const db = openStore(":memory:");
  for (const ev of [{ type: "pr_state_changed", data: null }, { type: "pr_state_changed", data: {} },
    { type: "pr_state_changed", data: { pr: { number: "x" }, sessionId: "s" } },
    { type: "pr_state_changed", data: { pr: { number: 1, state: "BOGUS" }, sessionId: "s" } }]) {
    expect(() => reduceEvent(db, ev as never)).not.toThrow();
  }
  expect((db.query("SELECT COUNT(*) AS n FROM pr_node").get() as { n: number }).n).toBe(0);
});

// ---- NEGATIVE: the remote read fails CLOSED ----
test("RT-N3: a remote fetch failure returns ok:false, never a green", async () => {
  const e = await guardrailRemote({ owner: "o", repo: "r", sha: "abc", fetchImpl: (async () => { throw new Error("net"); }) as never });
  expect(e.ok).toBe(false);
  expect(e.reasons[0]).toContain("REMOTE-FETCH-THREW");
});
test("RT-N4: a null sha returns ok:false, never a crash", async () => {
  const e = await guardrailRemote({ owner: "o", repo: "r", sha: null as never, fetchImpl: (async () => new Response("[]")) as never });
  expect(e.ok).toBe(false);
  expect(e.reasons[0]).toContain("INVALID-SHA");
});
