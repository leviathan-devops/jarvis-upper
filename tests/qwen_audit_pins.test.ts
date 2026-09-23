// qwen_audit_pins.test.ts — the pins for the qwen-code-audit gate's confirmed
// findings (7 critical + 20 high reported; the criticals adjudicated → 5 real,
// 2 refuted). Each pin goes RED if its fix is reverted.
//
// THE CRITICALS:
//   C1 adapter-verbs — a rejected PR fetch vanished silently
//   C2 attribute     — the documented "<0.6 → triage" was never enforced
//   C3 kick          — the dossier file READS ran before the db validation
//   C4/C5 store      — the FK rebuild DROPPED the MIGRATIONS CHECK constraints
//   C6/C7 runtime    — REFUTED: rail_seq IS persisted by EventRail.attach
//                      (measured: 0 → 11 after attach)
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { openStore } from "../src/store";
import { CONFIDENCE_FLOOR, attributeBug } from "../src/attribute";
import { EventRail } from "../ao-client/rail";

test("C2: a sub-floor assignment is labelled 'triage' (the documented contract)", async () => {
  // a MERGE-only commit scores 0.55 < CONFIDENCE_FLOOR (0.6)
  const fake = {
    run: async (cmd: string[]) => {
      if (cmd.includes("log") && cmd.includes("--format=%P")) return { code: 0, stdout: "p1 p2\n", stderr: "" };
      if (cmd.includes("log")) return { code: 0, stdout: "a".repeat(40) + "\n", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
  };
  const a = await attributeBug({ repo: "/tmp", files: ["f"] }, async () => ({ session: null, worker: null }), fake as never);
  expect(a.confidence).toBeLessThan(CONFIDENCE_FLOOR);
  expect(a.method).toBe("triage");
});

test("C4/C5: the FK rebuild PRESERVES the MIGRATIONS CHECKs and the FKs bite", () => {
  const path = `/tmp/store-pin-${Date.now()}.sqlite`;
  // a PRE-FK store (no FK, no CHECK) — the exact legacy shape the rebuild targets
  const raw = new Database(path, { create: true });
  raw.exec("CREATE TABLE pr_node(id TEXT PRIMARY KEY, project TEXT NOT NULL, pr_number INTEGER, session_id TEXT, worker_hint TEXT, head_sha TEXT, base_sha TEXT, source_branch TEXT, target_branch TEXT, kind TEXT DEFAULT 'feature', state TEXT, minted_at INTEGER, merged_at INTEGER, metadata_json TEXT)");
  raw.exec("CREATE TABLE gate_pass(id TEXT PRIMARY KEY, pr_node TEXT NOT NULL, gate TEXT NOT NULL, verdict TEXT NOT NULL, evidence TEXT, sha16 TEXT, at INTEGER)");
  raw.exec("INSERT INTO gate_pass(id,pr_node,gate,verdict) VALUES ('x','p','audit','pass')");
  raw.close();

  const db = openStore(path);
  const sql = (db.query("SELECT sql FROM sqlite_master WHERE name='gate_pass'").get() as { sql: string }).sql;
  expect(sql).toContain("CHECK(gate IN");            // the CHECK SURVIVED the rebuild
  expect(sql).toContain("FOREIGN KEY");
  // the row survived the copy
  expect((db.query("SELECT COUNT(*) AS n FROM gate_pass").get() as { n: number }).n).toBe(1);
  // and the CHECK BITES
  expect(() => db.query("INSERT INTO gate_pass(id,pr_node,gate,verdict) VALUES ('y','p','BOGUS','pass')").run()).toThrow();
  db.close();
});

test("C6/C7 REFUTED: EventRail.attach PERSISTS the cursor (rail_seq advances)", async () => {
  const db = openStore(":memory:");
  const rail = new EventRail(db);
  expect(rail.getCursor()).toBe(0);
  const sse = 'data: {"seq":10,"type":"x"}\n\ndata: {"seq":11,"type":"x"}\n\n';
  await rail.attach([sse], () => {});
  const row = db.query("SELECT last_seq FROM rail_seq WHERE source='ao-events'").get() as { last_seq: number } | null;
  expect(row?.last_seq).toBe(11);                     // the cursor IS persisted
  db.close();
});

// ─── the RE-RUN round (the second gate pass) ────────────────────────────────

test("R1: a rejection on a DIFFERENT sha does NOT block this head (no over-rejection)", async () => {
  const { verify } = await import("../src/verdict");
  const HEAD = "a".repeat(40);
  const OTHER = "b".repeat(40);
  const v = await verify({
    jobDir: "/tmp/x", headSha: HEAD, sessionId: "s",
    runFence: async () => ({ code: 1, stdout: "", stderr: "" }),   // isolate the review
    fetchReviews: async () => ({ runs: [
      { verdict: "changes_requested", targetSha: OTHER },          // a DIFFERENT revision
      { verdict: "approved", targetSha: HEAD },                    // THIS head
    ] }),
  });
  // the approval binds this head; the other-sha rejection must NOT block it
  expect(v.sources.review.reason).toBe("REVIEW-GREEN");
});

test("R1b: an approval on a DIFFERENT sha is STALE (named, never silently ignored)", async () => {
  const { verify } = await import("../src/verdict");
  const HEAD = "a".repeat(40);
  const v = await verify({
    jobDir: "/tmp/x", headSha: HEAD, sessionId: "s",
    runFence: async () => ({ code: 1, stdout: "", stderr: "" }),
    fetchReviews: async () => ({ runs: [{ verdict: "approved", targetSha: "760ad1bb42431b992d7a2168ff182e9893be5f65" }] }),
  });
  expect(v.sources.review.reason).toContain("REVIEW-STALE-SHA");
  expect(v.verdict).not.toBe("VERIFIED");
});

test("R2: verbOrder exits NON-ZERO when the plan HALTS (a halt is not success)", async () => {
  const { verbOrder } = await import("../src/cli-verbs");
  const { openStore } = await import("../src/store");
  const tmp = `/tmp/upper-order-${Date.now()}.sqlite`;
  const prev = process.env.UPPER_STORE;
  process.env.UPPER_STORE = tmp;
  try {
    const db = openStore(tmp);
    // a ready PR whose gates are NOT green -> the guardrail blocks -> the plan halts
    db.query("INSERT INTO pr_node(id,project,pr_number,session_id,state) VALUES ('h','p',1,'s','ready_to_merge')").run();
    db.close();
    const r = await verbOrder("/tmp", "--confirm");
    expect(r.code).toBe(1);                       // a halt is a NEGATIVE verdict
    expect(r.out.haltedAt).toBe("h");
  } finally {
    if (prev === undefined) delete process.env.UPPER_STORE; else process.env.UPPER_STORE = prev;
  }
});
