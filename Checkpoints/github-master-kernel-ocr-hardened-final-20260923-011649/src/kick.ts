// Kick rails: live (steerOrSend) | spawn (delegateTask) | direct (branch).
// Dossier hash gates every kick: payload must hash-match the recorded manifest.
import { Database } from "bun:sqlite";
import { dossierSha16 } from "./dossier";

export interface KickDeps {
  sessionAlive: (sessionId: string) => Promise<boolean>;
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
  const md = await deps.readFile(`${input.dossierPath}/dossier.md`);
  const oj = await deps.readFile(`${input.dossierPath}/origin.json`);
  const sha = dossierSha16(md, oj);
  const row = db.query("SELECT id FROM bug_record WHERE id = ?").get(input.bugId) as { id: string } | null;
  if (!row) throw new Error(`BUG-UNKNOWN:${input.bugId}`);
  const dossierRow = db.query(
    "SELECT dossier_path AS p FROM bug_record WHERE id = ?").get(input.bugId) as { p: string } | null;
  // F17: canonicalize — always use input.dossierPath (the caller-provided path)
  if (dossierRow && dossierRow.p !== input.dossierPath) throw new Error('DOSSIER-PATH-MISMATCH');
  const manifestPath = `${input.dossierPath}/manifest.sha16`;
  let recordedSha = "";
  try { recordedSha = (await deps.readFile(manifestPath)).trim(); } catch { /* missing = tamper */ }
  if (recordedSha !== sha) throw new Error("DOSSIER-TAMPER");
  let origin: unknown;
  try { origin = JSON.parse(oj); } catch { throw new Error('DOSSIER-CORRUPT:origin.json'); }
  const brief = fixBrief(input.bugId, input.originCommit, origin);
  const mode: KickMode = input.mode
    ?? ((input.originSession && await deps.sessionAlive(input.originSession).catch(() => false)) ? "live" : "spawn");
  if (mode === "live") {
    const sessionId = input.originSession;
    if (!sessionId) throw new Error('KICK-NO-SESSION');
    const r = await deps.send(sessionId, brief);
    if (!r.ok) throw new Error("KICK-SEND-FAILED");
    db.query(`INSERT INTO kick(id, bug_record, mode, target_session, dossier_path, dossier_sha16, sent_at, outcome)
              VALUES (?,?,?,?,?,?,strftime('%s','now'),'delivered')`)
      .run(`kick:${input.bugId}:${Date.now()}`, input.bugId, mode, input.originSession, input.dossierPath, sha);
    return { mode, target: sessionId, dossierSha16: sha };
  }
  if (mode === "spawn") {
    const r = await deps.spawn({ projectId: input.projectId, brief, attachments: [`${input.dossierPath}/dossier.md`, `${input.dossierPath}/origin.json`] });
    db.query(`INSERT INTO kick(id, bug_record, mode, spawned_session, dossier_path, dossier_sha16, sent_at, outcome)
              VALUES (?,?,?,?,?,?,strftime('%s','now'),'spawned')`)
      .run(`kick:${input.bugId}:${Date.now()}`, input.bugId, mode, r.sessionId, input.dossierPath, sha);
    return { mode, target: r.sessionId, dossierSha16: sha };
  }
  const b = await deps.openBranch(input.bugId);
  if (!b.ok) throw new Error("KICK-BRANCH-FAILED");
  db.query(`INSERT INTO kick(id, bug_record, mode, dossier_path, dossier_sha16, sent_at, outcome)
            VALUES (?,?,?, ?,?,strftime('%s','now'),'branched')`)
    .run(`kick:${input.bugId}:${Date.now()}`, input.bugId, mode, input.dossierPath, sha);
  return { mode, target: `fix/${input.bugId}`, dossierSha16: sha };
}
