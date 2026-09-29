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

// ── THE MULTI-PROJECT SURFACE ────────────────────────────────────────────────
// Each project writes its OWN status + tick log (write isolation, and a project's
// evidence is self-contained). The top-level status.json becomes the AGGREGATE.
export function projectStatusPath(root: string, id: string): string { return join(root, "runtime", id, "status.json"); }
export function projectTicksPath(root: string, id: string): string { return join(root, "runtime", id, "ticks.log"); }

/** The aggregate's per-project row. `ok:false` + the name is how a BROKEN project is
 *  reported without hiding the healthy ones — the settle-all contract at the status layer. */
export interface ProjectStatusRow extends RuntimeStatus { ok: boolean; error?: string; }

/** BACKWARD COMPATIBLE BY CONSTRUCTION: the aggregate carries every top-level RuntimeStatus
 *  field (so readStatus()/verbStatus keep working unchanged) PLUS the per-project rows. The
 *  top-level numbers are the SUM over the healthy projects — a reader that only knew the old
 *  shape sees the same keys, and a reader that knows the new one sees the fleet. */
export interface AggregateStatus extends RuntimeStatus {
  projects: Record<string, ProjectStatusRow>;
  /** the count of projects whose tick REJECTED this cycle (a loud, top-level number). */
  failed: number;
}

export function writeAggregate(root: string, agg: AggregateStatus): void {
  mkdirSync(join(root, "runtime"), { recursive: true });
  const p = statusPath(root);
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(agg, null, 2) + "\n", "utf8");
  renameSync(tmp, p);
}

/** Write a project's own status (atomic, in its own dir). */
export function writeProjectStatus(root: string, id: string, s: RuntimeStatus): void {
  const dir = join(root, "runtime", id);
  mkdirSync(dir, { recursive: true });
  const p = projectStatusPath(root, id);
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2) + "\n", "utf8");
  renameSync(tmp, p);
}
export function wireCapturePath(root: string): string { return join(root, "runtime/wire_capture.json"); }

export function writeStatus(root: string, s: RuntimeStatus, projectId?: string): void {
  // MULTI-PROJECT: an id routes the write into `runtime/<id>/status.json`. With no id the
  // path is the legacy top-level one — the single-project behavior is unchanged.
  const dir = projectId ? join(root, "runtime", projectId) : join(root, "runtime");
  mkdirSync(dir, { recursive: true });
  const p = projectId ? projectStatusPath(root, projectId) : statusPath(root);
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2) + "\n", "utf8");
  renameSync(tmp, p);
}

// FIXED (the W24 ship gate LOW): declared ABOVE its only user (it was below — a TDZ hazard
// on any module-init call).
let lastRotateLogAt = 0;

export function appendTick(root: string, s: RuntimeStatus, projectId?: string): void {
  const dir = projectId ? join(root, "runtime", projectId) : join(root, "runtime");
  mkdirSync(dir, { recursive: true });
  const line = `${s.ts} tick=${s.tick} daemonOk=${s.daemonOk} cursor=${s.cursor} prNodes=${s.prNodes} planKind=${s.planKind} errors=${s.errors.length}`;
  const logPath = projectId ? projectTicksPath(root, projectId) : ticksPath(root);
  appendFileSync(logPath, line + "\n", "utf8");
  // F54: rotation — truncate if log exceeds 10000 lines.
  // FIXED 2026-09-23 (ocr round-4 HIGH): the rotation read the ENTIRE file
  // synchronously on EVERY tick — O(n) per append, O(n^2) over the daemon's
  // life. A cheap statSync size check now gates the expensive read, so the full
  // read happens ONLY when the file is genuinely over the cap.
  try {
    const tp = projectId ? projectTicksPath(root, projectId) : ticksPath(root);
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
  } catch (e) {
    // FIXED (red-team slop audit SLOP-07): a persistently failing rotation (readonly
    // dir, full disk) retried each tick and NEVER surfaced. FIXED (the W15 ship gate LOW):
    // it then logged EVERY tick — throttle to once a minute.
    const now = Date.now();
    if (now - lastRotateLogAt > 60_000) { lastRotateLogAt = now; console.error(`status-rotate-failed:${String(e).slice(0, 60)}`); }
  }
}

export function readStatus(root: string): RuntimeStatus | null {
  const p = statusPath(root);
  if (!existsSync(p)) return null;
  // W-13 + the distinction law: an ABSENT status is a legitimate null (a project that has not
  // ticked yet). A CORRUPT one is NOT — conflating them hides a broken writer behind a
  // silent "no status". The corrupt case is named.
  try { return JSON.parse(readFileSync(p, "utf8")) as RuntimeStatus; }
  catch (e) { console.error(`status-read-failed:${p}:${String(e).slice(0, 60)}`); return null; }
}

export function tickRowCount(root: string): number {
  const p = ticksPath(root);
  if (!existsSync(p)) return 0;
  return readFileSync(p, "utf8").split("\n").filter((l) => l.trim().length > 0).length;
}
