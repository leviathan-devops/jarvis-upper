// Dossier law: sha16 over dossier.md+origin.json gates every kick.
import { createHash } from "node:crypto";

export interface DossierManifest {
  bugId: string;
  sha16: string;
  files: string[];
}

export function dossierSha16(dossierMd: string, originJson: string): string {
  // FIXED 2026-09-23 (ocr round-4 HIGH): hashing `md + "\n" + json` is
  // AMBIGUOUS — ("a\nb","c") and ("a","b\nc") both encode "a\nb\nc", so an
  // attacker who swaps the delimiter boundary between the two files passes the
  // gate while serving different content. LENGTH-PREFIX each component so the
  // encoding is injective.
  const h = createHash("sha256");
  h.update(`${Buffer.byteLength(dossierMd, "utf8")}:`, "utf8").update(dossierMd, "utf8");
  h.update(`${Buffer.byteLength(originJson, "utf8")}:`, "utf8").update(originJson, "utf8");
  return h.digest("hex").slice(0, 16);
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
  // FIXED 2026-09-23 (ocr round-4 HIGH x2): (a) JSON.stringify(undefined/fn/symbol)
  // returns the VALUE `undefined`, not a string — `?? "null"` guarantees a string
  // before it reaches the sha + the write. (b) the multi-write sequence gets
  // contextual error handling so a failure names the dossier, not a raw EIO.
  try {
    // also inside the try: JSON.stringify can throw on a cyclic/BigInt origin.
    const originJson = JSON.stringify(origin, null, 2) ?? "null";
    await Bun.write(`${dir}/dossier.md`, md);
    await Bun.write(`${dir}/origin.json`, originJson);
    const sha16 = dossierSha16(md, originJson);
    await Bun.write(`${dir}/manifest.sha16`, sha16 + "\n");
    return { bugId, sha16, files: [`${dir}/dossier.md`, `${dir}/origin.json`] };
  } catch (e) {
    throw new Error(`DOSSIER-WRITE-FAILED:${bugId}:${String(e).slice(0, 120)}`);
  }
}
