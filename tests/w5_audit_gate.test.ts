// W5 — THE AUDIT-GATE SUITE (red-team audit R14).
// A COMPLETED scan whose FINDINGS PROSE mentions "429"/"quota" must NOT be misread as
// PROVIDER_QUOTA_EXHAUSTED. The gate is exercised through its REAL register(pi) surface
// with a crafted OCR_BIN — the classification logic is the real one, never re-implemented.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXT = "/home/leviathan/.omp/agent/extensions/qwen-code-audit/index.js";

// a minimal pi.zod: every schema node carries .optional()/.describe() returning itself
const zod = (() => {
  const node = () => { const o: Record<string, unknown> = {}; o.optional = () => o; o.describe = () => o; return o; };
  return { string: node, number: node, boolean: node, object: () => node() };
})();

let modeFile = "";

interface GateTool {
  execute: (id: string, p: Record<string, unknown>) =>
    Promise<{ content: { text: string }[]; isError?: boolean; metadata?: { error?: string } }>;
}

async function runGate(): Promise<{ text: string; isError: boolean; error?: string }> {
  const mod = await import(EXT);
  // the assignment happens inside the registerTool callback, so the explicit type is
  // required (TS's flow analysis otherwise narrows `let tool = null` to `never`).
  const holder: { tool?: GateTool } = {};
  (mod.default as (pi: unknown) => void)({ zod, registerTool: (t: unknown) => { holder.tool = t as GateTool; } });
  if (!holder.tool) throw new Error("the tool did not register");
  const r = await holder.tool.execute("w5", { action: "scan", repo: "/tmp", scanPath: "x.ts" });
  return { text: r.content[0].text, isError: r.isError === true, error: r.metadata?.error };
}

test("test_audit_gate_prose_429_not_blocked", async () => {
  const dir = mkdtempSync(join(tmpdir(), "w5-ocr-"));
  modeFile = join(dir, "mode");
  const bin = join(dir, "ocr");
  writeFileSync(bin, `#!/usr/bin/env bash
MODE=$(cat "${modeFile}" 2>/dev/null || echo prose)
if [ "$MODE" = "quota" ]; then
  echo '{"session_id":"x","status":"error"}'
  echo "FreeUsageLimitError: workspace quota exhausted" >&2
  exit 1
fi
echo "[ocr] scanning 1 file..."
echo '{"session_id":"x","llm_failures":0,"summary":{"files_reviewed":1,"comments":1},"comments":[{"path":"a.ts","severity":"high","start_line":3,"content":"this handler returns HTTP 429 Too Many Requests and the provider quota is exceeded"}]}'
exit 0
`);
  chmodSync(bin, 0o755);
  process.env.OCR_BIN = bin;

  // (a) THE R14 CASE: a COMPLETED scan (llm_failures:0) whose finding PROSE says "429 quota".
  //     It must be judged on its FINDINGS — never blocked as quota-exhausted.
  writeFileSync(modeFile, "prose");
  const prose = await runGate();
  expect(prose.text).not.toContain("PROVIDER_QUOTA_EXHAUSTED");
  expect(prose.error).not.toBe("PROVIDER_QUOTA_EXHAUSTED");
  expect(prose.text).toContain("GATE: FAIL");          // the 1 high finding is counted
  expect(prose.text).toContain("1 high");

  // (b) THE NEGATIVE CONTROL: a REAL provider quota error (no llm_failures:0) MUST block.
  writeFileSync(modeFile, "quota");
  const quota = await runGate();
  expect(quota.text).toContain("PROVIDER_QUOTA_EXHAUSTED");
  expect(quota.error).toBe("PROVIDER_QUOTA_EXHAUSTED");
});
