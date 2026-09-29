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
// W5 corpus expansion — the remediated surfaces (each probe WOULD HAVE CAUGHT a real defect)
import { targetMatchesRemote } from "../src/target-guard";
import { syncPrs } from "../src/sync";
import { mergeRecorded } from "../src/merge-record";
import { listPrsFromAo } from "../src/adapter-verbs";

const GREEN = Object.fromEntries(REQUIRED_CONTEXTS.map((c) => [c, "success"]));
const readyDb = (head: string | null) => {
  const db = openStore(":memory:");
  db.query("INSERT INTO pr_node(id,project,pr_number,session_id,head_sha,state) VALUES ('p','x',1,'s',?, 'ready_to_merge')").run(head);
  return db;
};

// ---- POSITIVE: the attacks the guardrail exists to catch ----
test("RT-P1: a PR whose gates are FAILED blocks (with the precise reason)", () => {
  // FIXED (the audit MEDIUM K): `recordGatePass(db, "p", "abc", {})` records the four gates
  // with verdict='fail' (an empty states-map means every gate fails) — so this is the
  // present-but-FAILED case, and the reason is now GATE-FAILED:...:fail, not GATE-MISSING.
  const db = readyDb("abc"); recordGatePass(db, "p", "abc", {} as never);
  const e = guardrail(db, "p");
  expect(e.ok).toBe(false);
  expect(e.reasons.filter((r) => r.startsWith("GATE-FAILED:")).length).toBeGreaterThan(0);
});
test("RT-P1b: a PR whose gates are ABSENT blocks (GATE-MISSING, distinct from FAILED)", () => {
  // the twin the conflation erased: NO gate_pass rows → GATE-MISSING (never GATE-FAILED).
  const db = readyDb("abc");
  const e = guardrail(db, "p");
  expect(e.ok).toBe(false);
  expect(e.reasons.filter((r) => r.startsWith("GATE-MISSING:")).length).toBeGreaterThan(0);
  expect(e.reasons.some((r) => r.startsWith("GATE-FAILED:"))).toBe(false);
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


// ============================================================================
// W5 CORPUS EXPANSION — the remediated surfaces. Each probe is the ATTACK that
// would have caught the defect the remediation fixed (the red-team corpus law:
// the probe must fail on the pre-fix code and pass on the fixed code).
// ============================================================================

// ---- POSITIVE: the wrong-target POST (W-01) ----
test("RT-P7: a configured target != the tree's origin is REFUSED", () => {
  const e = targetMatchesRemote({ root: "/tmp", owner: "someone-else", repo: "other",
    readRemote: () => ({ url: "https://github.com/leviathan-devops/jarvis-upper.git", isRepo: true }) });
  expect(e.ok).toBe(false);
  expect(e.reason).toContain("TARGET-MISMATCH");
  // and a FAIL-CLOSED blind read refuses (never a silent pass)
  expect(targetMatchesRemote({ root: "/tmp", owner: "o", repo: "r", readRemote: () => { throw new Error("no git"); } }).ok).toBe(false);
  // the evil-suffix fail-open is closed
  expect(targetMatchesRemote({ root: "/tmp", owner: "leviathan-devops", repo: "jarvis-upper-evil", readRemote: () => ({ url: "https://github.com/leviathan-devops/jarvis-upper.git", isRepo: true }) }).ok).toBe(false);
});

// ---- POSITIVE: an AO payload claiming `merged` must NOT write the terminal state (R4) ----
test("RT-P8: sync CLAMPS a `merged` payload (the terminal row needs the ledger proof)", async () => {
  const db = openStore(":memory:");
  await syncPrs(db, async () => ([{ project: "x", pr_number: 1, session_id: "rt-p8", head_sha: "a".repeat(40), state: "merged" }] as never));
  const row = db.query("SELECT state FROM pr_node WHERE id = ?").get("pr:rt-p8:1") as { state: string } | null;
  expect(row?.state).toBe("merge_ordered");
  expect(row?.state).not.toBe("merged");
});

// ---- POSITIVE: one malformed row must NOT roll back the batch (R3) ----
test("RT-P9: a malformed AO row is SKIPPED, the good rows land", async () => {
  const db = openStore(":memory:");
  const r = await syncPrs(db, async () => ([
    { project: "x", pr_number: 1, session_id: "rt-p9", head_sha: "a".repeat(40), state: "open" },
    { project: "x", pr_number: 2, session_id: "rt-p9", head_sha: "a".repeat(40), state: "BOGUS" },
  ] as never));
  expect(r.rows).toBe(1);
  expect(r.skipped.length).toBe(1);
  expect(r.skipped[0]).toContain("BAD-STATE");
});

// ---- POSITIVE: an UNREADABLE ledger must THROW (R5 — never a false "absent") ----
test("RT-P10: an unreadable ledger THROWS, never a false 'not recorded'", () => {
  expect(() => mergeRecorded("/proc/1/mem", "abcdef123456")).toThrow(/LEDGER-UNREADABLE/);
});

// ---- EDGE: the batch error must name the RIGHT session (R10) ----
test("RT-E6: a batch-N failure names its OWN session, never a batch-0 shadow", async () => {
  const sessions = Array.from({ length: 10 }, (_, i) => ({ id: `rt-${i}`, projectId: "p" }));
  const captured: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { captured.push(a.map(String).join(" ")); };
  try {
    const callFn = (async (op: string, o: { params?: { sessionId?: string } }) => {
      if (op === "listSessions") return { sessions };
      if (op === "listSessionPRs") { if (o.params?.sessionId === "rt-9") throw new Error("AO-500"); return { sessionId: o.params?.sessionId, prs: [] }; }
      return null;
    }) as never;
    await listPrsFromAo({ callFn, project: "p" });
  } finally { console.error = orig; }
  const line = captured.find((l) => l.includes("PARTIAL")) ?? "";
  expect(line).toContain("rt-9");
  expect(line).not.toContain('"rt-1"');
});
