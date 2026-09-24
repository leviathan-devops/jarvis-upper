// W11 — the red-team slop audit's confirmed LOW findings, pinned.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("test_status_tick_parse_validated", async () => {
  // FIXED (SLOP-01): verbStatus recomputed the tick window with NO validation, so a
  // hostile UPPER_TICK_MS ("") made it 0 -> fresh=false -> a perpetual STALE.
  const root = mkdtempSync(join(tmpdir(), "w11-status-"));
  mkdirSync(join(root, "runtime"), { recursive: true });
  writeFileSync(join(root, "runtime", "status.json"), JSON.stringify({
    ts: new Date().toISOString(), tick: 1, daemonOk: true, cursor: 0, prNodes: 0,
    ready: 0, eligible: 0, planHash: null, planKind: "none", kicks: 0, errors: [],
  }));
  const prev = process.env.UPPER_TICK_MS;
  process.env.UPPER_TICK_MS = "";        // the hostile value
  try {
    const { verbStatus } = await import("../src/cli-verbs");
    const r = await verbStatus(root);
    // with the fix, "" -> 15000 -> a JUST-written status is FRESH -> RUNNING
    expect(r.out.verdict).toBe("RUNNING");
  } finally {
    if (prev === undefined) delete process.env.UPPER_TICK_MS; else process.env.UPPER_TICK_MS = prev;
  }
});

test("test_allowed_states_single_authority", async () => {
  // FIXED (SLOP-02): ALLOWED_STATES replayed PR_STATES instead of importing it.
  const { ALLOWED_STATES } = await import("../src/sync");
  const { PR_STATES } = await import("../src/store");
  expect(ALLOWED_STATES).toEqual(PR_STATES);
  const src = await Bun.file(new URL("../src/sync.ts", import.meta.url)).text();
  expect(src).toContain('import { PR_STATES } from "./store"');   // it IMPORTS now
  expect(src).not.toContain('["open", "ready_to_merge", "merge_ordered"');  // the literal is GONE
});

test("test_merge_corrupt_line_throws", async () => {
  // FIXED (SLOP-10): a CORRUPT merge line read as "not recorded" -> a duplicate row.
  const { mergeRecorded } = await import("../src/merge-record");
  const dir = mkdtempSync(join(tmpdir(), "w11-ledger-"));
  const p = join(dir, "v.jsonl");
  writeFileSync(p, '{"job":"merge","evidence":"abc1234|pr=1"\n');   // TRUNCATED json
  let threw = "";
  try { mergeRecorded(p, "abc1234"); } catch (e) { threw = String(e); }
  expect(threw).toContain("LEDGER-CORRUPT-LINE");
  // an ABSENT row in a READABLE file is still false (unchanged)
  writeFileSync(p, '{"job":"merge","evidence":"fffffff|pr=9"}\n');
  expect(mergeRecorded(p, "abc1234")).toBe(false);
});
