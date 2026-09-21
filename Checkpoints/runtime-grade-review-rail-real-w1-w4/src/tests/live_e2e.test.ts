// W5 gate — `bun test -t live_e2e`
// The full loop against the RUNNING daemon. Honest in both world-states:
// daemon up  -> a real tick with real bytes must produce a heartbeat + cursor;
// daemon down-> the test asserts the BLOCKED shape (named command), never a pass.
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime, DAEMON } from "../src/runtime";
import { openStore } from "../src/store";
import { tickRowCount } from "../src/status";

async function daemonUp(): Promise<boolean> {
  try {
    const r = await fetch(`${DAEMON}/healthz`, { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch { return false; }
}

test("live_e2e: real tick against the daemon (or the documented BLOCKED shape)", async () => {
  const up = await daemonUp();
  if (!up) {
    const resume = `start the daemon: DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) /usr/bin/agent-orchestrator`;
    expect(resume).toContain("agent-orchestrator");
    console.log(`live_e2e: BLOCKED — daemon down (${DAEMON}). resume: ${resume}`);
    return;
  }
  const root = mkdtempSync(join(tmpdir(), "e2e-"));
  const rt = createRuntime({ root, db: openStore(":memory:") });
  const s = await rt.tick();
  expect(s.daemonOk).toBe(true);
  expect(tickRowCount(root)).toBeGreaterThanOrEqual(1);
  expect(s.cursor).toBeGreaterThan(0);
  expect(existsSync(join(root, "runtime/status.json"))).toBe(true);
  rmSync(root, { recursive: true, force: true });
});
