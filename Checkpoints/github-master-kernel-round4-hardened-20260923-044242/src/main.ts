// main.ts — THE ENTRY POINT: boot the runtime, tick on a clock, stop on signals.
// Run:  UPPER_TICK_MS=2000 bun src/main.ts
import { fileURLToPath } from "node:url";
import { createRuntime } from "./runtime";
import { statusPath, ticksPath } from "./status";

// FIXED 2026-09-23 (ocr round-4 HIGH): new URL().pathname is not a filesystem
// path (wrong on Windows, and URL-encoded elsewhere) — fileURLToPath is the
// correct conversion.
const root = process.env.UPPER_ROOT ?? fileURLToPath(new URL("..", import.meta.url));
// FIXED 2026-09-23 (ocr round-4 HIGH): Number("") === 0 and Number("abc")
// === NaN — an empty/invalid env var produced a 0/NaN interval (a runaway
// tick storm). The default now applies to a parsed-but-invalid value too.
const rawTickMs = Number(process.env.UPPER_TICK_MS ?? 15000);
const tickMs = Number.isFinite(rawTickMs) && rawTickMs > 0 ? rawTickMs : 15000;
const rt = createRuntime({ root, deps: { tickMs } });

// FIXED 2026-09-23 (ocr round-4 HIGH): SIGTERM and SIGINT can both arrive before
// stop() completes — a re-entrancy guard prevents two concurrent rt.stop() calls
// racing to process.exit().
let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  const s = await rt.stop();
  console.log(JSON.stringify({ stopped: true, ticks: s.tick, daemonOk: s.daemonOk, status: statusPath(root), log: ticksPath(root) }));
  process.exit(0);
}
process.on("SIGTERM", () => void stop().catch((e) => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); }));
process.on("SIGINT", () => void stop().catch((e) => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); }));

rt.start();
console.log(JSON.stringify({ started: true, root, tickMs, status: statusPath(root), log: ticksPath(root) }));
