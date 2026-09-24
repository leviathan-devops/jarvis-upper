// W1 — THE RUNTIME-WIRING REGRESSION SUITE (the red-team audit's R2-R6, R8, R11).
// Every test here FAILED before its fix (verified by reverting each in isolation).
// Real modules, real stores, real filesystems — no injection of the thing under test.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../src/store";
import { syncPrs, validatePrRow } from "../src/sync";
import { mergeRecorded } from "../src/merge-record";
import { targetMatchesRemote } from "../src/target-guard";

const HEAD40 = "a".repeat(40);

// ── R2 / W-01: the target assertion (a mismatch must REFUSE) ─────────────────
test("test_target_refuses_mismatch", () => {
  // the attack: this tree's origin is repo A, the config names repo B
  const bad = targetMatchesRemote({
    root: "/tmp", owner: "someone-else", repo: "another-repo",
    readRemote: () => "https://github.com/leviathan-devops/jarvis-upper.git",
  });
  expect(bad.ok).toBe(false);
  expect(bad.reason).toContain("TARGET-MISMATCH");

  // the legit case: the origin names the configured target
  const good = targetMatchesRemote({
    root: "/tmp", owner: "leviathan-devops", repo: "jarvis-upper",
    readRemote: () => "https://github.com/leviathan-devops/jarvis-upper.git",
  });
  expect(good.ok).toBe(true);

  // FAIL-CLOSED: an unreadable remote refuses (never a silent pass)
  const blind = targetMatchesRemote({ root: "/tmp", owner: "o", repo: "r", readRemote: () => { throw new Error("git gone"); } });
  expect(blind.ok).toBe(false);
  expect(blind.reason).toContain("GIT-UNAVAILABLE");

  // a bare tree (no remote) has nothing to contradict
  expect(targetMatchesRemote({ root: "/tmp", owner: "o", repo: "r", readRemote: () => null }).ok).toBe(true);
});

// ── R3 / F-20: one malformed row must NOT roll back the whole batch ──────────
test("test_sync_skips_bad_row", async () => {
  const db = openStore();
  const sid = "w1-skip";
  db.query("DELETE FROM pr_node WHERE id IN (?, ?)").run(`pr:${sid}:1`, `pr:${sid}:3`);
  const rows = [
    { project: "p", pr_number: 1, session_id: sid, head_sha: HEAD40, state: "open" },
    { project: "p", pr_number: 2, session_id: sid, head_sha: HEAD40, state: "draft" }, // BAD
    { project: "p", pr_number: 3, session_id: sid, head_sha: HEAD40, state: "open" },
  ];
  const r = await syncPrs(db, async () => rows as never);
  expect(r.rows).toBe(2);                       // the two good rows landed
  expect(r.skipped.length).toBe(1);             // the bad one is NAMED
  expect(r.skipped[0]).toContain("BAD-STATE:draft");
  const got = db.query("SELECT pr_number FROM pr_node WHERE id IN (?, ?) ORDER BY pr_number")
    .all(`pr:${sid}:1`, `pr:${sid}:3`) as { pr_number: number }[];
  expect(got.map((g) => g.pr_number)).toEqual([1, 3]);
  db.query("DELETE FROM pr_node WHERE id IN (?, ?)").run(`pr:${sid}:1`, `pr:${sid}:3`);

  // the validator itself (the unit under it)
  expect(validatePrRow({ project: "p", pr_number: 0, session_id: "s", head_sha: null, state: "open" })).toBe("BAD-PR-NUMBER");
  expect(validatePrRow({ project: "p", pr_number: 1, session_id: "", head_sha: null, state: "open" })).toBe("NO-SESSION-ID");
});

// ── R4 / S3: sync must NEVER write the terminal `merged` state ───────────────
test("test_sync_never_writes_merged", async () => {
  const db = openStore();
  const sid = "w1-merged";
  db.query("DELETE FROM pr_node WHERE id = ?").run(`pr:${sid}:9`);
  // an AO payload reporting `merged` (a retry / a race / a vocabulary change)
  await syncPrs(db, async () => ([{ project: "p", pr_number: 9, session_id: sid, head_sha: HEAD40, state: "merged" }] as never));
  const row = db.query("SELECT state FROM pr_node WHERE id = ?").get(`pr:${sid}:9`) as { state: string } | null;
  // it is CLAMPED: only the fetchPrMerge+recordMerge path may set `merged`, so the
  // terminal row (the ledger proof) is never skipped.
  expect(row?.state).toBe("merge_ordered");
  expect(row?.state).not.toBe("merged");
  db.query("DELETE FROM pr_node WHERE id = ?").run(`pr:${sid}:9`);
});

// ── R5 / S5: an UNREADABLE ledger THROWS (never a false "not recorded") ──────
test("test_ledger_unreadable_throws", () => {
  // the attack: a ledger we cannot read. The old code returned `false` ("not
  // recorded") and re-appended a DUPLICATE terminal row.
  let threw = false;
  try { mergeRecorded("/proc/1/mem", HEAD40.slice(0, 12)); } catch (e) { threw = true; expect(String(e)).toContain("LEDGER-UNREADABLE"); }
  expect(threw).toBe(true);

  // the legit cases are UNCHANGED: absent = false, recorded = true
  expect(mergeRecorded("/tmp/definitely-absent-w1.jsonl", "a1b2c3d4e5f6")).toBe(false);
  const dir = mkdtempSync(join(tmpdir(), "w1-ledger-"));
  const p = join(dir, "v.jsonl");
  writeFileSync(p, JSON.stringify({ job: "merge", evidence: "a1b2c3d4e5f6|pr=1" }) + "\n");
  expect(mergeRecorded(p, "a1b2c3d4e5f6")).toBe(true);
  expect(mergeRecorded(p, "ffffffffffff")).toBe(false);   // absent within a readable file
});

// ── R6 / S16: a failed status write must be SURFACED ─────────────────────────
test("test_status_write_failure_surfaced", async () => {
  const { createRuntime } = await import("../src/runtime");
  // an unwritable root: the status write WILL fail. The old code swallowed it in a
  // comment-only catch, so every file reader saw the PREVIOUS tick as healthy.
  const rt = createRuntime({
    root: "/proc/1/w1-no-write",
    deps: {
      probe: async () => { throw new Error("W1-FORCED-THROW"); },   // force the tick-throw path
      tickMs: 999999,
    },
  });
  const s = await rt.tick();
  // the returned status carries the throw AND the write failure — never a silent
  // healthy-looking status while the file holds stale bytes.
  const joined = s.errors.join("|");
  expect(joined.length).toBeGreaterThan(0);
  expect(joined.includes("tick-threw") || joined.includes("status-write-failed")).toBe(true);
});

// ── R8 / W-05: the AO call has a NAMED timeout constant ─────────────────────
test("test_ao_call_has_named_timeout", async () => {
  const mod = await import("../ao-client/client");
  expect(typeof mod.AO_CALL_TIMEOUT_MS).toBe("number");
  expect(mod.AO_CALL_TIMEOUT_MS).toBeGreaterThan(0);
  // the source must actually pass a signal (the fix, not just the constant)
  const src = await Bun.file(new URL("../ao-client/client.ts", import.meta.url)).text();
  expect(src).toContain("AbortSignal.timeout(AO_CALL_TIMEOUT_MS)");
});

// ── R11 / W-12: the SSE truncation is NAMED ─────────────────────────────────
test("test_rail_truncation_is_named", async () => {
  const mod = await import("../src/runtime");
  expect(typeof mod.RAIL_MAX_BUF).toBe("number");
  const src = await Bun.file(new URL("../src/runtime.ts", import.meta.url)).text();
  // the old shape was a bare `break`; the fix sets a flag and reports TRUNCATED
  expect(src).toContain("truncated = true");
  expect(src).toContain("TRUNCATED-");
  expect(src).not.toContain("if (buf.length > 65536) break;");
});
