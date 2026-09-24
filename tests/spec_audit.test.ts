// tests/spec_audit.test.ts — `bun test -t spec_audit`
//
// THE ENVIRONMENT LAW: the spec lives OUTSIDE this repo
// (../packages/jarvis-upper-tier/..._SPEC.md). It EXISTS on the host but NOT in
// a CI checkout. A test that assumes it is present passes locally and FAILS in
// CI — the exact environment dependency the first real CI run exposed.
//
// THE CONTRACT TESTED (the exit-2 law, L9):
//   spec present   -> the 8 GS verdicts + VERDICT:(APPROVED|REJECTED), exit 0|1
//   spec ABSENT    -> SPEC-AUDIT-ERROR:spec-missing:<path>, exit 2 (UNMEASURED)
// A gate that cannot measure says so — it never crashes and never passes.
import { test, expect } from "bun:test";
import { existsSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const SPEC = `${ROOT}packages/jarvis-upper-tier/jarvis_upper_tier_DPL1_SPEC.md`;
const hasSpec = existsSync(SPEC);

const run = () => {
  const p = Bun.spawnSync(["bun", "scripts/spec-audit.ts"], { cwd: ROOT });
  return { code: p.exitCode ?? -1, out: (p.stdout?.toString() ?? "") + (p.stderr?.toString() ?? "") };
};

test("spec_audit: the spec's presence decides the branch (the env contract)", () => {
  const { code, out } = run();
  if (hasSpec) {
    // the spec is here: the full audit runs
    for (let i = 1; i <= 8; i++) expect(out).toContain(`GS-${i}:`);
    expect(out).toMatch(/VERDICT:(APPROVED|REJECTED)/);
    expect(out).toContain("findings:");
    expect(code).toBe(out.includes("VERDICT:APPROVED") ? 0 : 1);
  } else {
    // the spec is absent (CI): the LOUD-FAIL branch, exit 2 — never 0, never 1
    expect(out).toContain("SPEC-AUDIT-ERROR:spec-missing:");
    expect(code).toBe(2);
  }
});

test("spec_audit: never exits 0 when it cannot measure", () => {
  const { code, out } = run();
  if (!hasSpec) expect(code).toBe(2);
  expect(out).not.toContain("VERDICT:APPROVED");   // no phantom approval
});
