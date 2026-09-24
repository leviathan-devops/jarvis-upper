// merge_record: the TERMINAL-EVENT RECORDER. The factory observes the merge and
// records the merge commit's sha. These tests drive the REAL functions.
import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchPrMerge, recordMerge, mergeRecorded } from "../src/merge-record";

const MERGE_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

test("merge_record: a MERGED PR yields the merge sha", async () => {
  const f = (async () => ({ ok: true, status: 200, json: async () => ({ merged: true, merge_commit_sha: MERGE_SHA, state: "closed" }) })) as unknown as typeof fetch;
  const m = await fetchPrMerge({ owner: "o", repo: "r", prNumber: 2, token: "t", fetchImpl: f });
  expect(m.merged).toBe(true);
  expect(m.mergeCommitSha).toBe(MERGE_SHA);
});

test("merge_record: an OPEN PR is not merged", async () => {
  const f = (async () => ({ ok: true, status: 200, json: async () => ({ merged: false, merge_commit_sha: null, state: "open" }) })) as unknown as typeof fetch;
  const m = await fetchPrMerge({ owner: "o", repo: "r", prNumber: 2, token: "t", fetchImpl: f });
  expect(m.merged).toBe(false);
  expect(m.mergeCommitSha).toBeNull();
});

test("merge_record: NEGATIVE — a missing target is a named refusal, never a request", async () => {
  let called = false;
  const f = (async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; }) as unknown as typeof fetch;
  const m = await fetchPrMerge({ owner: "", repo: "r", prNumber: 2, token: "t", fetchImpl: f });
  expect(m.state).toBe("NO-TARGET");
  expect(called).toBe(false);
});

test("merge_record: NEGATIVE — a 404 is HTTP-404, not a throw", async () => {
  const f = (async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch;
  const m = await fetchPrMerge({ owner: "o", repo: "r", prNumber: 9, token: "t", fetchImpl: f });
  expect(m.state).toBe("HTTP-404");
  expect(m.merged).toBe(false);
});

test("merge_record: recordMerge appends the terminal row and is idempotent-detectable", () => {
  const dir = mkdtempSync(join(tmpdir(), "merge-ledger-"));
  const ledger = join(dir, "verdicts.jsonl");
  expect(mergeRecorded(ledger, MERGE_SHA)).toBe(false);
  const ok = recordMerge(ledger, { prId: "pr:s:2", prNumber: 2, mergeSha: MERGE_SHA, headSha: "c3c3ed0d562e", session: "jarvis-upper-4" });
  expect(ok).toBe(true);
  const line = readFileSync(ledger, "utf8").trim();
  expect(line).toContain('"job":"merge"');
  expect(line).toContain('"verdict":"MERGED"');
  expect(line).toContain(MERGE_SHA);
  expect(mergeRecorded(ledger, MERGE_SHA)).toBe(true);
});
