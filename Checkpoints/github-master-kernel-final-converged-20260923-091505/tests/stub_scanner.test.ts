// stub_scanner.test.ts — the pin for the ocr confirm HIGH + the two DEAD-GATE
// bugs it exposed in .githooks/lib/scan-stub.sh (the W-14 scanner).
//
// BEFORE the fix the scanner could not detect a multi-line NotImplemented stub:
//   1. `${l//[^}]/}` — bash reads the `}` inside the bracket as the expansion
//      TERMINATOR, so the close-brace count was garbage -> the body "closed" on
//      the signature line and was never accumulated.
//   2. `[[ "$x" =~ ^thrownewError"notimplemented"$ ]]` — the `"` are SHELL QUOTES,
//      so the regex became `^thrownewErrornotimplemented$`, which never matches
//      the literal `thrownewError"notimplemented"`.
// Result: a stub shape sailed through green (a FALSE GREEN). This test makes the
// scanner prove it FIRES on the real shape and stays SILENT on a brace-in-string
// function (the ocr finding's own false-positive scenario).
import { test, expect } from "bun:test";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SCANNER = join(import.meta.dir, "..", ".githooks", "lib", "scan-stub.sh");

function scan(src: string): { hits: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "stub-"));
  const f = join(dir, "a.ts");
  writeFileSync(f, src);
  const p = Bun.spawnSync(["bash", "-c", `source "${SCANNER}"; scan_stub "${f}"`]);
  const out = p.stdout?.toString() ?? "";
  return { hits: out.split("\n").filter((l) => l.startsWith("STUB:")).length, out };
}

test("stub_scanner: a MULTI-LINE NotImplemented stub FIRES (the dead-gate fix)", () => {
  const { hits, out } = scan(`export function realStub(): never {\n  throw new Error("not implemented");\n}\n`);
  expect(hits).toBe(1);
  expect(out).toContain("realStub");
});

test("stub_scanner: a brace INSIDE a string does NOT false-positive", () => {
  // the ocr finding's scenario: `return "}";` must not close the body early
  const { hits } = scan(`export function fine(): string {\n  return JSON.stringify({ "a": "}" });\n}\n`);
  expect(hits).toBe(0);
});

test("stub_scanner: a real function with a defensive throw is NOT a stub", () => {
  const { hits } = scan(`export function real(a: number): number {\n  if (a < 0) throw new Error("bad");\n  return a * 2;\n}\n`);
  expect(hits).toBe(0);
});

test("stub_scanner: the `stubbed: true` shape still fires (no regression)", () => {
  const { hits } = scan(`export function f() { return { stubbed: true }; }\n`);
  expect(hits).toBe(1);
});
