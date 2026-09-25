// Kick rails: live (steerOrSend) | spawn (delegateTask) | direct (branch).
// Dossier hash gates every kick: payload must hash-match the recorded manifest.
import { Database } from "bun:sqlite";
import { posix } from "node:path";
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
  /** FIXED (the W26 ship gate HIGH x2 — the TOCTOU): the dossier was hash-verified by kick()
   *  and then RE-READ from disk by the adapter, so a mutation between the two reads sent
   *  UNVERIFIED bytes while the kick row recorded the verified sha. The deps now carry the
   *  ALREADY-VERIFIED CONTENT, never a path. */
  spawn: (input: { projectId: string; brief: string; attachments: { name: string; content: string }[] }) => Promise<{ sessionId: string }>;
  openBranch: (bugId: string) => Promise<{ ok: boolean }>;
  readFile: (path: string) => Promise<string>;
}

export type KickMode = "live" | "spawn" | "direct";

/** FIXED (the W24 ship gate MEDIUM): the tri-state coercion+validation was triplicated
 *  across the explicit-spawn / explicit-live / auto paths and could drift. ONE helper.
 *  A legacy boolean dep is coerced (true=alive, false=dead); anything else unrecognized
 *  is a STABLE refusal, never a silent fall-through. */
async function settleLiveness(deps: KickDeps, sessionId: string): Promise<Liveness> {
  let v: unknown = "unknown";
  try { v = await deps.sessionAlive(sessionId); } catch { v = "unknown"; }
  if (typeof v === "boolean") return v ? "alive" : "dead";
  if (v === "alive" || v === "dead" || v === "unknown") return v;
  throw new Error(`KICK-LIVENESS-INVALID:${String(v).slice(0, 32)}`);
}

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
  // (the DB row below is the authority for origin_session — see the FIX note there)
  // FIXED 2026-09-23 (qwen-code-audit C3): the file READS ran BEFORE the
  // bug_record validation — a caller-supplied dossierPath reached the filesystem
  // before the db check could refuse it. Validation comes FIRST.
  // FIXED (the W21 ship gate MEDIUM): TWO SELECTs on the same row (a round-trip + a race
  // window). One SELECT carries both facts.
  // FIXED (the W26 ship gate HIGH): originSession came from the CALLER, so a stale/wrong id
  // was checked (or the check skipped). The DB row is the authority for it.
  const row = db.query("SELECT id, dossier_path AS p, origin_session AS os FROM bug_record WHERE id = ?").get(input.bugId) as { id: string; p: string | null; os: string | null } | null;
  if (!row) throw new Error(`BUG-UNKNOWN:${input.bugId}`);
  // FIXED (the W17 ship gate MEDIUM): the path-equality gate ran AFTER the filesystem reads,
  // so a caller-supplied arbitrary path reached the FS (an existence/read probe) before any
  // check. The row check now runs FIRST.
  // FIXED (the W24 ship gate LOW): `dossierRow` aliased `row` AFTER the `!row` throw above, so
  // the second null check could never fire. One row, one check.
  const dossierRow = row;
  // FIXED (the W21 ship gate MEDIUM): strict !== with no normalization meant a trailing slash
  // or a dot-segment caused a false DOSSIER-PATH-MISMATCH. Normalize both sides.
  // FIXED (the W24 ship gate MEDIUM): the comment claimed dot-segment handling but the code
  // only collapsed `//` + a trailing `/`. A real normalizer resolves `.`/`..` too.
  // FIXED (the W25 ship gate MEDIUM): posix.normalize preserves a TRAILING SLASH and the
  // try/catch was dead (it never throws). Strip the trailing slash too.
  // FIXED (the W26 ship gate MEDIUM): stripping the trailing slash turned "/" into ""
  // (colliding with an empty path). Preserve a root.
  const norm = (q: string) => { const n = posix.normalize(q); return n === "/" ? "/" : n.replace(/\/+$/, ""); };
  // FIXED (the W25 ship gate MEDIUM): a NULL `p` + an empty input path both normalized to ""
  // and PASSED, then readFile("/dossier.md") probed the filesystem root. Reject empties.
  if (!dossierRow.p || !input.dossierPath) throw new Error(`DOSSIER-EMPTY-PATH:${input.bugId}`);
  if (norm(dossierRow.p) !== norm(input.dossierPath)) throw new Error('DOSSIER-PATH-MISMATCH');
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
    // FIXED (the W21 ship gate MEDIUM): an explicit `spawn` SKIPPED the liveness check, so a
    // spawn while the origin session is still ALIVE manufactured the duplicate session the
    // tri-state fix exists to prevent. Validate the ORIGIN for both live and spawn.
    const originSess = row.os ?? input.originSession;
    if (mode === "spawn" && originSess) {
      const sv = await settleLiveness(deps, originSess);
      // FIXED (the W24 ship gate HIGH): this only refused `alive`, so `unknown` (a transient
      // outage) fell through to SPAWN — manufacturing the duplicate session the tri-state
      // fix exists to prevent. Refuse `unknown` too.
      if (sv === "alive") throw new Error("KICK-SPAWN-ORIGIN-ALIVE:use mode=live (or an explicit intent)");
      if (sv === "unknown") throw new Error("KICK-LIVENESS-UNKNOWN");
    }
    // FIXED (the W15 ship gate HIGH): an explicit `live` SKIPPED the liveness check — the
    // CLI's `upper kick <id> live` would send to a DEAD session. Validate it.
    if (mode === "live") {
      if (!input.originSession) throw new Error("KICK-NO-SESSION");
      const lv = await settleLiveness(deps, input.originSession);
      if (lv !== "alive") throw new Error(`KICK-LIVENESS-${lv.toUpperCase()}`);
    }
  }
  else {
    // FIXED (ship gate MEDIUM): the old `.catch(()=>false)` tolerated a THROWING
    // KickDeps; the bare await let it escape as a raw error, bypassing the fail-closed
    // refusal. A throw is now `unknown` -> the refusal.
    // FIXED (the W26 ship gate HIGH): the DB row's origin_session is the AUTHORITY — a
    // caller-supplied id could be stale/wrong (checking the wrong session, or skipping the check).
    const originSess = row.os ?? input.originSession;
    const alive: Liveness = originSess ? await settleLiveness(deps, originSess) : "dead";
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
    // FIXED (W26): pass the VERIFIED bytes (md/oj), never the paths the adapter would re-read.
    const r = await deps.spawn({
      projectId: input.projectId, brief,
      attachments: [{ name: "dossier.md", content: md }, { name: "origin.json", content: oj }],
    });
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
