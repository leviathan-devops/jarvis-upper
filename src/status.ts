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
// FIXED (the audit SLOP-08): a single MODULE-LEVEL timestamp was shared by every project's
// appendTick, so project A's rotation failure suppressed project B's for up to 60 s — the one
// mutable state two concurrent ticks could touch. Throttled PER LOG now.
const lastRotateLogAt = new Map<string, number>();

export function appendTick(root: string, s: RuntimeStatus, projectId?: string): void {
  const dir = projectId ? join(root, "runtime", projectId) : join(root, "runtime");
  mkdirSync(dir, { recursive: true });
  const line = `${s.ts} tick=${s.tick} daemonOk=${s.daemonOk} cursor=${s.cursor} prNodes=${s.prNodes} planKind=${s.planKind} errors=${s.errors.length}`;
  // FIXED (the ship gate LOW): `logPath` and `tp` were TWO names for ONE value — a future edit
  // to one could diverge the append target from the rotation/throttle key. ONE name now.
  const logPath = projectId ? projectTicksPath(root, projectId) : ticksPath(root);
  appendFileSync(logPath, line + "\n", "utf8");
  // F54: rotation — truncate when the log exceeds its byte CAP (below). The comment previously
  // named "10000 lines"; the enforced bound is 1 MiB (≈11,439 short rows) — the two numbers
  // disagreed (the audit SLOP-13). The bound is the BYTE cap, named once, below.
  // FIXED 2026-09-23 (ocr round-4 HIGH): the rotation read the ENTIRE file
  // synchronously on EVERY tick — O(n) per append, O(n^2) over the daemon's
  // life. A cheap statSync size check now gates the expensive read, so the full
  // read happens ONLY when the file is genuinely over the cap.
  // FIXED (the audit SLOP-08 + the ship gate LOW): ONE path value — `logPath` above — is the
  // append target, the rotation target, AND the throttle key. (`tp` was a second name for it.)
  try {
    const CAP_BYTES = 1024 * 1024; // exactly 1 MiB — the enforced byte cap (≈11,439 short rows)
    if (statSync(logPath).size > CAP_BYTES) {
      // FIXED 2026-09-23 (qwen-code-audit high): split('\n') on a trailing-newline
      // file yields a final "", so the join produced a DOUBLE newline.
      const lines = readFileSync(logPath, "utf8").split("\n").filter((l) => l !== "");
      // FIXED 2026-09-23 (ocr round-4 HIGH): the rotation overwrote the live log
      // in place — a crash mid-write left it truncated. tmp + rename is atomic,
      // matching writeStatus.
      // FIXED (run 4): a pid-derived tmp name is predictable (a symlink target).
      const tmp = `${logPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
      writeFileSync(tmp, lines.slice(-5000).join("\n") + "\n", "utf8");
      renameSync(tmp, logPath);
    }
  } catch (e) {
    // FIXED (red-team slop audit SLOP-07): a persistently failing rotation (readonly
    // dir, full disk) retried each tick and NEVER surfaced. FIXED (the W15 ship gate LOW):
    // it then logged EVERY tick — throttle to once a minute.
    const now = Date.now();
    // FIXED (the ship gate LOW): the throttle Map grew WITHOUT BOUND — one entry per distinct log
    // path retained forever (a leak under many ephemeral projects). Bound it: over 100 entries,
    // evict the oldest half (the throttle only needs RECENT keys).
    if (lastRotateLogAt.size > 100) {
      const keys = [...lastRotateLogAt.keys()];
      for (const k of keys.slice(0, 50)) lastRotateLogAt.delete(k);
    }
    // FIXED (ship gate low): eviction by INSERTION order is not LRU — refresh recency on update,
    // so a frequently-throttled path is not evicted first (losing its 60s throttle).
    if (now - (lastRotateLogAt.get(logPath) ?? 0) > 60_000) {
      lastRotateLogAt.delete(logPath); lastRotateLogAt.set(logPath, now);
      console.error(`status-rotate-failed:${logPath}:${String(e).slice(0, 60)}`);
    }
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
