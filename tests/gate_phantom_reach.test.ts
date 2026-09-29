// W3 wave — `bun test -t test_gate_phantom_diff`
// Tests for the phantom-completion gate (W-3), the reachability gate (W-2),
// the hardened claim-evidence gate (W-8), and the W1 header on W3-owned files.
//
// Uses real temp repos + real bash. Asserts on real stdout/stderr/exitCode.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const LIB = join(ROOT, ".githooks", "lib", "pattern-header.sh");
const PHANTOM = join(ROOT, ".githooks", "lib", "scan-phantom.sh");
const PREPARE = join(ROOT, ".githooks", "prepare-commit-msg");
const PRE_PUSH = join(ROOT, ".githooks", "pre-push");

function sh(
  script: string,
  cwd?: string
): { code: number; out: string; err: string } {
  const p = Bun.spawnSync(["bash", "-c", script], {
    cwd: cwd ?? ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: p.exitCode ?? -1,
    out: p.stdout?.toString() ?? "",
    err: p.stderr?.toString() ?? "",
  };
}

function makeTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "gate-phantom-"));
  sh("git init && git config user.email 'test@test' && git config user.name 'Test'", dir);
  return dir;
}

// --- W-3: PHANTOM-DIFF gate ---

test("test_gate_phantom_diff", () => {
  // 1. Positive: empty diff + completion claim -> PHANTOM-DIFF:
  {
    const repo = makeTempRepo();
    sh('git commit --allow-empty -m "feat: implemented the thing"', repo);
    const r = sh(`bash "${PHANTOM}" HEAD`, repo);
    expect(r.out).toContain("PHANTOM-DIFF:");
    expect(r.out).toContain("implemented the thing");
  }

  // 2. Negative: real change + completion claim -> NO PHANTOM-DIFF
  {
    const repo = makeTempRepo();
    writeFileSync(join(repo, "foo.ts"), "export const x = 1;\n");
    sh("git add foo.ts", repo);
    sh('git commit -m "feat: implemented the thing"', repo);
    const r = sh(`bash "${PHANTOM}" HEAD`, repo);
    expect(r.out).not.toContain("PHANTOM-DIFF:");
  }

  // 3. Negative: real change + non-completion claim -> NO PHANTOM-DIFF
  {
    const repo = makeTempRepo();
    writeFileSync(join(repo, "bar.ts"), "export const y = 2;\n");
    sh("git add bar.ts", repo);
    sh('git commit -m "feat: add bar module"', repo);
    const r = sh(`bash "${PHANTOM}" HEAD`, repo);
    expect(r.out).not.toContain("PHANTOM-DIFF:");
  }
});

// --- W-8: hardened claim-evidence (case-insensitive anchor) ---

test("test_claim_evidence_hardened", () => {
  function runPreCommit(msg: string): { code: number; out: string; err: string } {
    const p = Bun.spawnSync(
      ["bash", PREPARE, "/dev/stdin", "message"],
      {
        cwd: ROOT,
        stdin: Buffer.from(msg),
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    return {
      code: p.exitCode ?? -1,
      out: p.stdout?.toString() ?? "",
      err: p.stderr?.toString() ?? "",
    };
  }

  // PASS: lowercase anchor with extension
  const r1 = runPreCommit("fix: verified src/foo.ts:12");
  expect(r1.code).toBe(0);

  // PASS: UPPERCASE anchor (the FIRING 006 fix)
  const r2 = runPreCommit("fix: verified SKILL.md:100");
  expect(r2.code).toBe(0);

  // PASS: bare path:line without extension (pre-commit:24 pattern)
  const r3 = runPreCommit("fix: verified pre-commit:24");
  expect(r3.code).toBe(0);

  // PASS: test-count evidence
  const r4 = runPreCommit("fix: verified 70 pass");
  expect(r4.code).toBe(0);

  // PASS: sha evidence
  const r5 = runPreCommit("fix: verified abcdef1");
  expect(r5.code).toBe(0);

  // REJECT: bare claim, no evidence
  const r6 = runPreCommit("fix: verified the gate");
  expect(r6.code).toBe(1);
  expect(r6.err).toContain("REJECT(W-8)");
});

// --- W1 headers ---

test("test_w1_headers_present", () => {
  // header_ok on prepare-commit-msg -> exit 0
  const r1 = sh(`bash -c 'source "${LIB}"; header_ok "${PREPARE}"; echo "exit=$?"'`);
  expect(r1.out).toContain("exit=0");

  // header_ok on pre-push -> exit 0
  const r2 = sh(`bash -c 'source "${LIB}"; header_ok "${PRE_PUSH}"; echo "exit=$?"'`);
  expect(r2.out).toContain("exit=0");

  // header_ok on scan-phantom.sh -> exit 0
  const r3 = sh(`bash -c 'source "${LIB}"; header_ok "${PHANTOM}"; echo "exit=$?"'`);
  expect(r3.out).toContain("exit=0");
});

// --- W-2: reachability gate structure ---

test("test_reachability_gate_structure", () => {
  // Verify the pre-push hook contains the W-2 reachability logic.
  const content = readFileSync(PRE_PUSH, "utf-8");
  expect(content).toContain("ORPHAN:");
  expect(content).toContain("REJECT(W-2)");
  // UPDATED 2026-09-23 (ocr round-3): the reference search moved from
  // `grep -rlw` over the working tree to `git grep -lw` against the PUSHED tree
  // (a push of a branch that is not checked out gave a wrong reference set).
  // This is a TEXT pin on the implementation; the BEHAVIOR is proven by the
  // live probe (a real push of an orphan -> REJECT(W-2), rc=1).
  expect(content).toMatch("grep -lFw");   // -F: the stem is a literal, not a regex
  // Verify the existing main refusal is intact.
  expect(content).toContain("direct pushes to main are not permitted");
});
