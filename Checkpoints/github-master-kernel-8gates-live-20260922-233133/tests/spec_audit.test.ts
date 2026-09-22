// W4 gate — `bun test -t spec_audit`
import { test, expect } from "bun:test";

const run = () => {
  const p = Bun.spawnSync(["bun", "scripts/spec-audit.ts"], { cwd: new URL("..", import.meta.url).pathname });
  return { code: p.exitCode ?? -1, out: (p.stdout?.toString() ?? "") + (p.stderr?.toString() ?? "") };
};

test("spec_audit: emits all eight GS verdicts with tokens", () => {
  const { out } = run();
  for (let i = 1; i <= 8; i++) expect(out).toContain(`GS-${i}:`);
  expect(out).toMatch(/VERDICT:(APPROVED|REJECTED)/);
  expect(out).toContain("findings:");
});

test("spec_audit: exit code is 0 iff the spec is APPROVED", () => {
  const { code, out } = run();
  expect(code).toBe(out.includes("VERDICT:APPROVED") ? 0 : 1);
});

test("spec_audit: names the historical seam on the real spec", () => {
  const { out } = run();
  const failed = out.split("\n").filter((l) => /^GS-\d:FAIL:/.test(l));
  expect(failed.length).toBeGreaterThan(0);
  expect(out).toContain("NO criterion names a process artifact"); // GS-1 — the seam
});
