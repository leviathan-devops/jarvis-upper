// status.ts — the runtime's observable output: status.json + ticks.log.
// Atomic status writes; append-only tick rows. No external dependencies.
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, renameSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export interface RuntimeStatus {
  ts: string;
  tick: number;
  daemonOk: boolean;
  cursor: number;
  prNodes: number;
  ready: number;
  eligible: number;
  planHash: string | null;
  planKind: "ok" | "cycle" | "none";
  kicks: number;
  errors: string[];
}

export function statusPath(root: string): string { return join(root, "runtime/status.json"); }
export function ticksPath(root: string): string { return join(root, "runtime/ticks.log"); }
export function wireCapturePath(root: string): string { return join(root, "runtime/wire_capture.json"); }

export function writeStatus(root: string, s: RuntimeStatus): void {
  mkdirSync(join(root, "runtime"), { recursive: true });
  const p = statusPath(root);
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2) + "\n", "utf8");
  renameSync(tmp, p);
}

export function appendTick(root: string, s: RuntimeStatus): void {
  mkdirSync(join(root, "runtime"), { recursive: true });
  const line = `${s.ts} tick=${s.tick} daemonOk=${s.daemonOk} cursor=${s.cursor} prNodes=${s.prNodes} planKind=${s.planKind} errors=${s.errors.length}`;
  appendFileSync(ticksPath(root), line + "\n", "utf8");
  // F54: rotation — truncate if log exceeds 10000 lines.
  // FIXED 2026-09-23 (ocr round-4 HIGH): the rotation read the ENTIRE file
  // synchronously on EVERY tick — O(n) per append, O(n^2) over the daemon's
  // life. A cheap statSync size check now gates the expensive read, so the full
  // read happens ONLY when the file is genuinely over the cap.
  try {
    const tp = ticksPath(root);
    const CAP_BYTES = 1024 * 1024; // ~1 MiB, well under 10000 short lines
    if (statSync(tp).size > CAP_BYTES) {
      // FIXED 2026-09-23 (qwen-code-audit high): split('\n') on a trailing-newline
      // file yields a final "", so the join produced a DOUBLE newline.
      const lines = readFileSync(tp, "utf8").split("\n").filter((l) => l !== "");
      // FIXED 2026-09-23 (ocr round-4 HIGH): the rotation overwrote the live log
      // in place — a crash mid-write left it truncated. tmp + rename is atomic,
      // matching writeStatus.
      // FIXED (run 4): a pid-derived tmp name is predictable (a symlink target).
      const tmp = `${tp}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
      writeFileSync(tmp, lines.slice(-5000).join("\n") + "\n", "utf8");
      renameSync(tmp, tp);
    }
  } catch { /* rotation is best-effort */ }
}

export function readStatus(root: string): RuntimeStatus | null {
  const p = statusPath(root);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")) as RuntimeStatus; } catch { return null; }
}

export function tickRowCount(root: string): number {
  const p = ticksPath(root);
  if (!existsSync(p)) return 0;
  return readFileSync(p, "utf8").split("\n").filter((l) => l.trim().length > 0).length;
}
