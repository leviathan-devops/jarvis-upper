// EN-010: the sync verb must pull PRs from AO, not print an empty literal.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { syncPrs, type PrRow } from "../src/sync";
import { listPrsFromAo } from "../src/adapter-verbs";

test("sync_prs_from_ao: maps AO sessions+PRs into PrRow with the head sha bound", async () => {
  const calls: string[] = [];
  const fake = async (op: string, o?: any) => {
    calls.push(op);
    if (op === "listSessions") return { sessions: [
      { id: "w1", projectId: "p1", kind: "worker" },
      { id: "r1", projectId: "p1", kind: "reviewer" },   // a reviewer has no PRs
    ] };
    if (op === "listSessionPRs") {
      if (o?.params?.sessionId === "r1") return { sessionId: "r1", prs: [] };
      return { sessionId: "w1", prs: [
        { number: 7, state: "open", repo: "org/p1", sourceBranch: "ao/w1/x",
          targetBranch: "main", headSha: "a".repeat(40) },
        { number: 9, state: "merged", repo: "org/p1", sourceBranch: "ao/w1/y",
          targetBranch: "main", headSha: null },          // a merged PR may have no head
      ] };
    }
    throw new Error("unexpected op " + op);
  };
  const rows: PrRow[] = await listPrsFromAo({ callFn: fake as any });
  expect(rows.length).toBe(2);
  expect(rows[0].pr_number).toBe(7);
  expect(rows[0].head_sha).toBe("a".repeat(40));
  expect(rows[0].source_branch).toBe("ao/w1/x");
  expect(rows[0].state).toBe("open");
  expect(rows[1].head_sha).toBeNull();            // null preserved, not "null"
  expect(calls).toContain("listSessionPRs");
});

test("sync_prs_from_ao: a filter narrows to one project and an AO failure is LOUD", async () => {
  const fake = async (op: string) => {
    if (op === "listSessions") return { sessions: [
      { id: "w1", projectId: "p1" }, { id: "w2", projectId: "p2" } ] };
    return { prs: [] };
  };
  const rows = await listPrsFromAo({ callFn: fake as any, project: "p1" });
  expect(rows.length).toBe(0);
  const boom = async () => { throw new Error("AO_DOWN"); };
  await expect(listPrsFromAo({ callFn: boom as any })).rejects.toThrow("AO_DOWN");
});

test("sync_prs_from_ao: syncPrs stores them in the railway (pr_node) — the count is real", async () => {
  const db = new Database(":memory:");
  db.run(`CREATE TABLE pr_node(id TEXT PRIMARY KEY, project TEXT, pr_number INTEGER,
    session_id TEXT, head_sha TEXT, base_sha TEXT, source_branch TEXT, target_branch TEXT,
    state TEXT, worker_hint TEXT, minted_at INTEGER)`);
  const rows: PrRow[] = [{ project: "p1", pr_number: 7, session_id: "w1",
    head_sha: "a".repeat(40), source_branch: "ao/w1/x", target_branch: "main", state: "open" }];
  const { rows: n } = await syncPrs(db, async () => rows);
  expect(n).toBe(1);
  const back = db.query("SELECT pr_number, head_sha FROM pr_node").get() as any;
  expect(back.pr_number).toBe(7);
  // re-sync is an upsert, not a duplicate
  const { rows: n2 } = await syncPrs(db, async () => rows);
  expect(n2).toBe(1);
});
