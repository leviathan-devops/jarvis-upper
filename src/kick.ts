// Kick rails: live (steerOrSend) | spawn (delegateTask) | direct (branch).
// Dossier hash gates every kick: payload must hash-match the recorded manifest.
import { Database } from "bun:sqlite";
import { dossierSha16 } from "./dossier";

// FIXED 2026-09-23 (ocr round-4 HIGH): `kick:<bugId>:<Date.now()>` collided for
// two kicks of the same bug inside one millisecond. A random suffix makes the
// id unique regardless of the clock.
const kickSuffix = (): string => Math.random().toString(36).slice(2, 10);

/** FIXED (ship-gate MEDIUM): liveness is TRI-STATE. `unknown` (a transport failure) is
 *  NOT `dead` — collapsing them spawned a duplicate session during a daemon outage. */
export type Liveness = "alive" | "dead" | "unknown";

export interface KickDeps {
  sessionAlive: (sessionId: string) => Promise<Liveness>;
  send: (sessionId: string, brief: string) => Promise<{ ok: boolean }>;
  spawn: (input: { projectId: string; brief: string; attachments: string[] }) => Promise<{ sessionId: string }>;
  openBranch: (bugId: string) => Promise<{ ok: boolean }>;
  readFile: (path: string) => Promise<string>;
}

export type KickMode = "live" | "spawn" | "direct";

export interface KickResult {
  mode: KickMode;
  target: string;
  dossierSha16: string;
}

export function fixBrief(bugId: string, originCommit: string, originJson: unknown): string {
  return `BUG ${bugId} — origin commit ${originCommit}.\n` +
    `Fix contract: smallest correct change; no unrelated edits; add/extend the regression test that would have caught this.\n` +
    `Report via PR citing ${bugId} in the title.\norigin: ${JSON.stringify(originJson)}`;
}

export async function kick(
  db: Database,
  deps: KickDeps,
  input: { bugId: string; projectId: string; originSession: string | null; originCommit: string; dossierPath: string; mode?: KickMode },
): Promise<KickResult> {
  // FIXED 2026-09-23 (qwen-code-audit C3): the file READS ran BEFORE the
  // bug_record validation — a caller-supplied dossierPath reached the filesystem
  // before the db check could refuse it. Validation comes FIRST.
  const row = db.query("SELECT id FROM bug_record WHERE id = ?").get(input.bugId) as { id: string } | null;
  if (!row) throw new Error(`BUG-UNKNOWN:${input.bugId}`);
  // FIXED (the W17 ship gate MEDIUM): the path-equality gate ran AFTER the filesystem reads,
  // so a caller-supplied arbitrary path reached the FS (an existence/read probe) before any
  // check. The row check now runs FIRST.
  const dossierRow = db.query(
    "SELECT dossier_path AS p FROM bug_record WHERE id = ?").get(input.bugId) as { p: string } | null;
  // FIXED (ship gate MEDIUM): a NULL row (a concurrent delete / a race) SKIPPED the gate and
  // the caller-supplied path still reached the filesystem (an arbitrary-read probe). Fail closed.
  if (!dossierRow) throw new Error(`DOSSIER-NO-ROW:${input.bugId}`);
  if (dossierRow.p !== input.dossierPath) throw new Error('DOSSIER-PATH-MISMATCH');
  const md = await deps.readFile(`${input.dossierPath}/dossier.md`);
  const oj = await deps.readFile(`${input.dossierPath}/origin.json`);
  const sha = dossierSha16(md, oj);
  const manifestPath = `${input.dossierPath}/manifest.sha16`;
  let recordedSha = "";
  try { recordedSha = (await deps.readFile(manifestPath)).trim(); } catch { /* missing = tamper */ }
  if (recordedSha !== sha) throw new Error("DOSSIER-TAMPER");
  let origin: unknown;
  try { origin = JSON.parse(oj); } catch { throw new Error('DOSSIER-CORRUPT:origin.json'); }
  const brief = fixBrief(input.bugId, input.originCommit, origin);
  // FIXED (ship-gate MEDIUM): an UNKNOWN liveness REFUSES rather than falling through to
  // spawn — a transient daemon outage must not manufacture a second session for one bug.
  let mode: KickMode;
  if (input.mode) {
    // FIXED (the W16 ship gate MEDIUM): an out-of-whitelist mode fell through to `direct`
    // (openBranch) while returning the bogus mode. Fail closed.
    if (input.mode !== "live" && input.mode !== "spawn" && input.mode !== "direct") {
      throw new Error(`KICK-BAD-MODE:${String(input.mode).slice(0, 32)}`);
    }
    mode = input.mode;
    // FIXED (the W15 ship gate HIGH): an explicit `live` SKIPPED the liveness check — the
    // CLI's `upper kick <id> live` would send to a DEAD session. Validate it.
    if (mode === "live") {
      if (!input.originSession) throw new Error("KICK-NO-SESSION");
      let lv: Liveness = "unknown";
      try { lv = await deps.sessionAlive(input.originSession); } catch { lv = "unknown"; }
      if (typeof lv === "boolean") lv = lv ? "alive" : "dead";   // FIXED: the legacy boolean
      // FIXED (the W17 ship gate MEDIUM): a garbage value must be a STABLE refusal, matching
      // the auto path — not KICK-LIVENESS-<GARBAGE>.
      // FIXED (the W20 ship gate LOW): the auto path kept the value in the error (the value
      // IS the diagnosis for a legacy/typo dep); the explicit path dropped it. Both keep it.
      if (lv !== "alive" && lv !== "dead" && lv !== "unknown") throw new Error(`KICK-LIVENESS-INVALID:${String(lv).slice(0, 32)}`);
      if (lv !== "alive") throw new Error(`KICK-LIVENESS-${lv.toUpperCase()}`);
    }
  }
  else {
    // FIXED (ship gate MEDIUM): the old `.catch(()=>false)` tolerated a THROWING
    // KickDeps; the bare await let it escape as a raw error, bypassing the fail-closed
    // refusal. A throw is now `unknown` -> the refusal.
    let alive: Liveness = "dead";
    if (input.originSession) {
      try { alive = await deps.sessionAlive(input.originSession); } catch { alive = "unknown"; }
    }
    // FIXED (ship gate MEDIUM): an unrecognized Liveness (a legacy boolean `true`, a typo)
    // fell through to `spawn` — a duplicate session. Exhaustive.
    // FIXED (the W15 ship gate MEDIUM): a legacy boolean dep (the pre-tri-state shape) threw
    // KICK-LIVENESS-INVALID. Coerce it (true=alive, false=dead) for back-compat.
    if (typeof alive === "boolean") alive = alive ? "alive" : "dead";
    if (alive !== "alive" && alive !== "dead" && alive !== "unknown") {
      throw new Error(`KICK-LIVENESS-INVALID:${String(alive).slice(0, 32)}`);
    }
    if (alive === "unknown") throw new Error("KICK-LIVENESS-UNKNOWN");
    mode = alive === "alive" ? "live" : "spawn";
  }
  if (mode === "live") {
    const sessionId = input.originSession;
    if (!sessionId) throw new Error('KICK-NO-SESSION');
    const r = await deps.send(sessionId, brief);
    if (!r.ok) throw new Error("KICK-SEND-FAILED");
    db.query(`INSERT INTO kick(id, bug_record, mode, target_session, dossier_path, dossier_sha16, sent_at, outcome)
              VALUES (?,?,?,?,?,?,strftime('%s','now'),'delivered')`)
      .run(`kick:${input.bugId}:${Date.now()}:${kickSuffix()}`, input.bugId, mode, input.originSession, input.dossierPath, sha);
    return { mode, target: sessionId, dossierSha16: sha };
  }
  if (mode === "spawn") {
    const r = await deps.spawn({ projectId: input.projectId, brief, attachments: [`${input.dossierPath}/dossier.md`, `${input.dossierPath}/origin.json`] });
    db.query(`INSERT INTO kick(id, bug_record, mode, spawned_session, dossier_path, dossier_sha16, sent_at, outcome)
              VALUES (?,?,?,?,?,?,strftime('%s','now'),'spawned')`)
      .run(`kick:${input.bugId}:${Date.now()}:${kickSuffix()}`, input.bugId, mode, r.sessionId, input.dossierPath, sha);
    return { mode, target: r.sessionId, dossierSha16: sha };
  }
  const b = await deps.openBranch(input.bugId);
  if (!b.ok) throw new Error("KICK-BRANCH-FAILED");
  db.query(`INSERT INTO kick(id, bug_record, mode, dossier_path, dossier_sha16, sent_at, outcome)
            VALUES (?,?,?, ?,?,strftime('%s','now'),'branched')`)
    .run(`kick:${input.bugId}:${Date.now()}:${kickSuffix()}`, input.bugId, mode, input.dossierPath, sha);
  return { mode, target: `fix/${input.bugId}`, dossierSha16: sha };
}
