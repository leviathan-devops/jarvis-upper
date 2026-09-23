// Dossier law: sha16 over dossier.md+origin.json gates every kick.
import { createHash } from "node:crypto";
import { isAbsolute, resolve, relative } from "node:path";

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
  // FIXED 2026-09-23 (qwen-code-audit run 5 REAL): a `root` carrying ".." escaped
  // the intended scope. It must be an ABSOLUTE path, and `path.resolve` normalizes
  // any traversal away BEFORE the join.
  if (typeof root !== "string" || !isAbsolute(root)) throw new Error(`INVALID-ROOT:${root}`);
  const base = resolve(root);
  const dir = resolve(base, "dossiers", bugId);
  const rel = relative(base, dir);
  if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) throw new Error(`ROOT-ESCAPE:${bugId}`);
  return dir;
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
    const sha16 = dossierSha16(md, originJson);
    // FIXED 2026-09-23 (ocr confirm HIGH): three separate writes had no atomicity
    // — a kill between them left a stale manifest over new content. Write to temp
    // files and RENAME each into place (atomic per file); the MANIFEST renames
    // LAST, so a crash before it leaves content the manifest does not match — the
    // reader's sha check then DETECTS the partial state instead of trusting it.
    const { rename } = await import("node:fs/promises");
    const rnd = Math.random().toString(36).slice(2, 8);
    const mdTmp = `${dir}/dossier.md.tmp-${rnd}`;
    const ojTmp = `${dir}/origin.json.tmp-${rnd}`;
    const manTmp = `${dir}/manifest.sha16.tmp-${rnd}`;
    await Bun.write(mdTmp, md);
    await Bun.write(ojTmp, originJson);
    await Bun.write(manTmp, sha16 + "\n");
    await rename(mdTmp, `${dir}/dossier.md`);
    await rename(ojTmp, `${dir}/origin.json`);
    await rename(manTmp, `${dir}/manifest.sha16`);
    return { bugId, sha16, files: [`${dir}/dossier.md`, `${dir}/origin.json`] };
  } catch (e) {
    throw new Error(`DOSSIER-WRITE-FAILED:${bugId}:${String(e).slice(0, 120)}`);
  }
}
