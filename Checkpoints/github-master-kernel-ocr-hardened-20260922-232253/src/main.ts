// main.ts — THE ENTRY POINT: boot the runtime, tick on a clock, stop on signals.
// Run:  UPPER_TICK_MS=2000 bun src/main.ts
import { createRuntime } from "./runtime";
import { statusPath, ticksPath } from "./status";

const root = process.env.UPPER_ROOT ?? new URL("..", import.meta.url).pathname;
const tickMs = Number(process.env.UPPER_TICK_MS ?? 15000);
const rt = createRuntime({ root, deps: { tickMs } });

async function stop(): Promise<void> {
  const s = await rt.stop();
  console.log(JSON.stringify({ stopped: true, ticks: s.tick, daemonOk: s.daemonOk, status: statusPath(root), log: ticksPath(root) }));
  process.exit(0);
}
process.on("SIGTERM", () => void stop().catch((e) => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); }));
process.on("SIGINT", () => void stop().catch((e) => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); }));

rt.start();
console.log(JSON.stringify({ started: true, root, tickMs, status: statusPath(root), log: ticksPath(root) }));
