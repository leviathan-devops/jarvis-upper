// W3 gate: dead session falls to spawn citing commit; live delivers.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { openStore } from "../src/store";
import { kick } from "../src/kick";
import { writeDossier, dossierSha16 } from "../src/dossier";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";

const ROOT = await mkdtemp(join(tmpdir(), "kick-"));

async function seeded(db: Database, bugId: string): Promise<string> {
  const m = await writeDossier(ROOT, bugId, "# BUG\nsymptom\n", { origin: "c0ffee" });
  db.query("INSERT INTO bug_record(id, found_by, dossier_path, status) VALUES (?, 'thanatos', ?, 'open')")
    .run(bugId, `${ROOT}/dossiers/${bugId}`);
  return m.sha16;
}

function deps(over: Partial<Parameters<typeof kick>[1]> = {}) {
  const sent: string[] = [];
  const spawned: any[] = [];
  return {
    sent, spawned,
    base: {
      sessionAlive: async () => true,
      send: async (s: string) => { sent.push(s); return { ok: true }; },
      spawn: async (i: any) => { spawned.push(i); return { sessionId: "fix-1" }; },
      openBranch: async () => ({ ok: true }),
      readFile: (p: string) => Bun.file(p).text(),
      ...over,
    } as Parameters<typeof kick>[1],
  };
}

test("kick_fallback: live session delivers brief", async () => {
  const db = openStore(":memory:");
  const sha = await seeded(db, "k-live");
  const d = deps();
  const r = await kick(db, d.base, { bugId: "k-live", projectId: "p", originSession: "s-1", originCommit: "c0ffee", dossierPath: `${ROOT}/dossiers/k-live` });
  expect(r.mode).toBe("live");
  expect(r.target).toBe("s-1");
  expect(r.dossierSha16).toBe(sha);
  expect(d.sent.length).toBe(1);
  const rows = db.query("SELECT outcome FROM kick").all() as { outcome: string }[];
  expect(rows.map((x) => x.outcome)).toEqual(["delivered"]);
  db.close();
});

test("kick_fallback: dead session spawns citing commit sha", async () => {
  const db = openStore(":memory:");
  await seeded(db, "k-dead");
  const d = deps({ sessionAlive: async () => false });
  const r = await kick(db, d.base, { bugId: "k-dead", projectId: "p", originSession: "s-9", originCommit: "deadbeef01", dossierPath: `${ROOT}/dossiers/k-dead` });
  expect(r.mode).toBe("spawn");
  expect(r.target).toBe("fix-1");
  expect(d.spawned.length).toBe(1);
  expect(d.spawned[0].brief.includes("deadbeef01")).toBe(true);
  expect(d.spawned[0].attachments.length).toBe(2);
  const rows = db.query("SELECT outcome FROM kick").all() as { outcome: string }[];
  expect(rows.map((x) => x.outcome)).toEqual(["spawned"]);
  db.close();
});

test("kick_fallback: explicit direct opens branch", async () => {
  const db = openStore(":memory:");
  await seeded(db, "k-dir");
  let branched = "";
  const d = deps({ openBranch: async () => { branched = "fix/k-dir"; return { ok: true }; } });
  const r = await kick(db, d.base, { bugId: "k-dir", projectId: "p", originSession: null, originCommit: "c0ffee", dossierPath: `${ROOT}/dossiers/k-dir`, mode: "direct" });
  expect(r.mode).toBe("direct");
  expect(r.target).toBe("fix/k-dir");
  expect(branched).toBe("fix/k-dir");
  db.close();
});
