// W1 interfaces wave — `bun test -t test_gate_header_standard`
// Contract under test: .githooks/lib/pattern-header.sh is the gate-header
// standard every later gate follows. The test SOURCES the real library via
// bash (never a re-implementation) and asserts on real stdout/stderr/exitCode.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const LIB = join(ROOT, ".githooks", "lib", "pattern-header.sh");

function sh(script: string): { code: number; out: string; err: string } {
  const p = Bun.spawnSync(["bash", "-c", `source "${LIB}"; ${script}`], { cwd: ROOT });
  return { code: p.exitCode ?? -1, out: p.stdout?.toString() ?? "", err: p.stderr?.toString() ?? "" };
}

test("test_gate_header_standard", () => {
  // 1. pattern_header prints all 5 labelled lines.
  const h = sh(`pattern_header W-13 119 "a src/**/*.ts diff" "silent-fallback" "pre-commit"`);
  expect(h.code).toBe(0);
  const lines = h.out.trim().split("\n");
  expect(lines.length).toBe(5);
  expect(h.out).toContain("# GATE W-13 — silent-fallback");
  expect(h.out).toContain("# JEV COUNT: 119");
  expect(h.out).toContain("# ARTIFACT CLASS: a src/**/*.ts diff");
  expect(h.out).toContain("# SURFACE: pre-commit");
  expect(h.out).toContain("# PREDICATE READS: a src/**/*.ts diff — NEVER prose");

  // 2. gate_reject prints REJECT(<ID>) to stderr and sets FAIL=1.
  const r = sh(`FAIL=0; gate_reject W-13 "a silent catch found"; echo "FAIL=$FAIL"`);
  expect(r.err).toContain("REJECT(W-13)");
  expect(r.err).toContain("a silent catch found");
  expect(r.out).toContain("FAIL=1");

  // 3. gate_pass prints "<ID>: PASS".
  const g = sh(`gate_pass W-13`);
  expect(g.code).toBe(0);
  expect(g.out).toContain("W-13: PASS");

  // 4. header_ok: exit 0 on a file carrying all 5 lines, exit 1 on one missing a line.
  const dir = mkdtempSync(join(tmpdir(), "gate-header-"));
  const good = join(dir, "good.sh");
  // a REAL gate carries a shebang first (git uses it to pick the interpreter);
  // header_ok now requires it — a hook without one runs under `sh` and
  // `set -o pipefail` fails. The fixture must match the real shape.
  writeFileSync(good, "#!/usr/bin/env bash\n" + h.out);
  const okGood = sh(`header_ok "${good}"; echo "exit=$?"`);
  expect(okGood.out).toContain("exit=0");

  const partial = join(dir, "partial.sh");
  writeFileSync(partial, lines.slice(0, 4).join("\n") + "\n");
  const okPartial = sh(`header_ok "${partial}"; echo "exit=$?"`);
  expect(okPartial.out).toContain("exit=1");

  // 5. NEGATIVE: a gate file with NO header is rejected by header_ok.
  const bare = join(dir, "bare.sh");
  writeFileSync(bare, "#!/usr/bin/env bash\nset -uo pipefail\nFAIL=0\n");
  const okBare = sh(`header_ok "${bare}"; echo "exit=$?"`);
  expect(okBare.out).toContain("exit=1");
  // the live case: pre-commit NOW carries a header (W2 added it) — the assertion
  // was a W1-era snapshot ("no header YET") and is updated to the new truth.
  // The NEGATIVE half is preserved by the synthetic bare file above.
  const okPre = sh(`header_ok .githooks/pre-commit; echo "exit=$?"`);
  expect(okPre.out).toContain("exit=0");
});
