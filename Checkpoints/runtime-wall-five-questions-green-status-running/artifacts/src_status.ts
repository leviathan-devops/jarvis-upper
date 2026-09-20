// status.ts — the runtime's observable output: status.json + ticks.log.
// Atomic status writes; append-only tick rows. No external dependencies.
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, renameSync, existsSync } from "node:fs";
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
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2) + "\n", "utf8");
  renameSync(tmp, p);
}

export function appendTick(root: string, s: RuntimeStatus): void {
  mkdirSync(join(root, "runtime"), { recursive: true });
  const line = `${s.ts} tick=${s.tick} daemonOk=${s.daemonOk} cursor=${s.cursor} prNodes=${s.prNodes} planKind=${s.planKind} errors=${s.errors.length}`;
  appendFileSync(ticksPath(root), line + "\n", "utf8");
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
