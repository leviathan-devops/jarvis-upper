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
  void 0; // dossier hash is checked against manifest.sha16 below (DOSSIER-TAMPER on mismatch)
  const row = db.query("SELECT id FROM bug_record WHERE id = ?").get(input.bugId) as { id: string } | null;
  if (!row) throw new Error(`BUG-UNKNOWN:${input.bugId}`);
  const dossierRow = db.query(
    "SELECT dossier_path AS p FROM bug_record WHERE id = ?").get(input.bugId) as { p: string } | null;
  const manifestPath = `${dossierRow?.p ?? input.dossierPath}/manifest.sha16`;
  let recordedSha = "";
  try { recordedSha = (await deps.readFile(manifestPath)).trim(); } catch { /* missing = tamper */ }
  if (recordedSha !== sha) throw new Error("DOSSIER-TAMPER");
  const origin = JSON.parse(oj);
  const brief = fixBrief(input.bugId, input.originCommit, origin);
  const mode: KickMode = input.mode
    ?? ((input.originSession && await deps.sessionAlive(input.originSession)) ? "live" : "spawn");
  if (mode === "live") {
    const r = await deps.send(input.originSession!, brief);
    if (!r.ok) throw new Error("KICK-SEND-FAILED");
    db.query(`INSERT INTO kick(id, bug_record, mode, target_session, dossier_path, dossier_sha16, sent_at, outcome)
              VALUES (?,?,?,?,?,?,strftime('%s','now'),'delivered')`)
      .run(`kick:${input.bugId}:${Date.now()}`, input.bugId, mode, input.originSession, input.dossierPath, sha);
    return { mode, target: input.originSession!, dossierSha16: sha };
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
