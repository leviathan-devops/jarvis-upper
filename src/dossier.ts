// Dossier law: sha16 over dossier.md+origin.json gates every kick.
import { createHash } from "node:crypto";

export interface DossierManifest {
  bugId: string;
  sha16: string;
  files: string[];
}

export function dossierSha16(dossierMd: string, originJson: string): string {
  return createHash("sha256").update(dossierMd, "utf8").update("\n", "utf8").update(originJson, "utf8").digest("hex").slice(0, 16);
}

const BUGID_RE = /^[A-Za-z0-9_-]+$/;

export function dossierDir(root: string, bugId: string): string {
  if (!BUGID_RE.test(bugId) || bugId.includes("..")) throw new Error(`INVALID-BUGID:${bugId}`);
  return `${root.replace(/\/$/, "")}/dossiers/${bugId}`;
}

export async function writeDossier(root: string, bugId: string, md: string, origin: unknown): Promise<DossierManifest> {
  const dir = dossierDir(root, bugId);
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  const originJson = JSON.stringify(origin, null, 2);
  await Bun.write(`${dir}/dossier.md`, md);
  await Bun.write(`${dir}/origin.json`, originJson);
  const sha16 = dossierSha16(md, originJson);
  await Bun.write(`${dir}/manifest.sha16`, sha16 + "\n");
  return { bugId, sha16, files: [`${dir}/dossier.md`, `${dir}/origin.json`] };
}
