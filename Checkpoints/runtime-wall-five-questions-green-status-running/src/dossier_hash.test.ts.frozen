// W3 gate: tampered dossier refuses DOSSIER-TAMPER; hash is law.
import { test, expect } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { openStore } from "../src/store";
import { kick } from "../src/kick";
import { writeDossier } from "../src/dossier";

test("dossier_hash: edited dossier.md after manifest refuses", async () => {
  const root = await mkdtemp(join(tmpdir(), "dose-"));
  await writeDossier(root, "k-t", "# BUG\nreal\n", { origin: "x" });
  const db = openStore(":memory:");
  db.query("INSERT INTO bug_record(id, found_by, dossier_path, status) VALUES ('k-t','thanatos',?,'open')")
    .run(`${root}/dossiers/k-t`);
  // tamper: rewrite dossier.md after manifest was stamped
  await Bun.write(`${root}/dossiers/k-t/dossier.md`, "# BUG\nTAMPERED\n");
  const deps = {
    sessionAlive: async () => true,
    send: async () => ({ ok: true }),
    spawn: async () => ({ sessionId: "x" }),
    openBranch: async () => ({ ok: true }),
    readFile: (p: string) => Bun.file(p).text(),
  };
  let err = "";
  try {
    await kick(db, deps, { bugId: "k-t", projectId: "p", originSession: "s", originCommit: "x", dossierPath: `${root}/dossiers/k-t` });
  } catch (e) { err = String(e); }
  expect(err.includes("DOSSIER-TAMPER")).toBe(true);
  const rows = db.query("SELECT COUNT(*) AS n FROM kick").get() as { n: number };
  expect(rows.n).toBe(0);
  db.close();
});
