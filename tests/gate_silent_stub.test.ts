// W2 silent+stub wave — `bun test -t test_gate_silent_fallback`
// Contract under test: .githooks/lib/scan-silent.sh (W-13, Jev 119) and
// .githooks/lib/scan-stub.sh (W-14, Jev 68) fire on their attack shapes and
// stay silent on clean code, wired through the pre-commit path (sourced
// libraries + real temp files + real bash invocation, never a re-impl).
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const LIBDIR = join(ROOT, ".githooks", "lib");

test("test_gate_silent_fallback", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-silent-stub-"));

  // 1. POSITIVE silent: an empty catch fires SILENT-FALLBACK via the real lib.
  const silent = join(dir, "silent.ts");
  writeFileSync(silent, "try { foo(); } catch (e) {}\n");
  const sHit = Bun.spawnSync(["bash", "-c", `source "${LIBDIR}/scan-silent.sh"; scan_silent "${silent}"`], { cwd: ROOT });
  const sHitOut = sHit.stdout?.toString() ?? "";
  expect(sHitOut).toContain("SILENT-FALLBACK:");
  expect(sHitOut).toContain(silent);
  expect(sHit.exitCode ?? 0).toBeGreaterThan(0);

  // 2. NEGATIVE silent: a clean try/catch (rethrow) produces NO hit.
  const clean = join(dir, "clean.ts");
  writeFileSync(clean, "try { foo(); } catch (e) { throw e; }\n");
  const sClean = Bun.spawnSync(["bash", "-c", `source "${LIBDIR}/scan-silent.sh"; scan_silent "${clean}"`], { cwd: ROOT });
  expect(sClean.stdout?.toString() ?? "").not.toContain("SILENT-FALLBACK:");
  expect(sClean.exitCode ?? -1).toBe(0);

  // 3. POSITIVE stub: a stubbed literal fires STUB via the real lib.
  const stub = join(dir, "stub.ts");
  writeFileSync(stub, "export function f() { return { stubbed: true }; }\n");
  const tHit = Bun.spawnSync(["bash", "-c", `source "${LIBDIR}/scan-stub.sh"; scan_stub "${stub}"`], { cwd: ROOT });
  const tHitOut = tHit.stdout?.toString() ?? "";
  expect(tHitOut).toContain("STUB:");
  expect(tHitOut).toContain(stub);
  expect(tHit.exitCode ?? 0).toBeGreaterThan(0);

  // 4. NEGATIVE stub: a clean file produces NO stub hit.
  const cleanTs = join(dir, "clean2.ts");
  writeFileSync(cleanTs, "export function f() { return 42; }\n");
  const tClean = Bun.spawnSync(["bash", "-c", `source "${LIBDIR}/scan-stub.sh"; scan_stub "${cleanTs}"`], { cwd: ROOT });
  expect(tClean.stdout?.toString() ?? "").not.toContain("STUB:");
  expect(tClean.exitCode ?? -1).toBe(0);

  // 5. The pre-commit hook now carries the W1 5-line headers (W-13 + W-14).
  const hdr = Bun.spawnSync(["bash", "-c", `source "${LIBDIR}/pattern-header.sh"; header_ok .githooks/pre-commit; echo "exit=$?"`], { cwd: ROOT });
  expect(hdr.stdout?.toString() ?? "").toContain("exit=0");
  const w13 = Bun.spawnSync(["bash", "-c", `grep -qE '^# GATE W-13' .githooks/pre-commit && echo W13_OK`], { cwd: ROOT });
  expect(w13.stdout?.toString() ?? "").toContain("W13_OK");
  const w14 = Bun.spawnSync(["bash", "-c", `grep -qE '^# GATE W-14' .githooks/pre-commit && echo W14_OK`], { cwd: ROOT });
  expect(w14.stdout?.toString() ?? "").toContain("W14_OK");
});
