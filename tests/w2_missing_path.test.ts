// W2 — THE MISSING-PATH SUITE (red-team audit R1/R7/R9).
// promote, the fence-job preflight refusal, and the WIRED kick.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../src/store";
import { dossierSha16 } from "../src/dossier";
import { kick } from "../src/kick";

const HEAD40 = "b".repeat(40);
const ROOT = join(import.meta.dir, "..");

function putBug(id: string, dossierPath: string) {
  const db = openStore();
  db.query("DELETE FROM bug_record WHERE id = ?").run(id);
  db.query("INSERT INTO bug_record(id, dossier_path, origin_commit, origin_session, status, created_at) VALUES (?,?,?,?,?,?)")
    .run(id, dossierPath, "c0ffee", null, "open", 0);
  db.close();
}
function delBug(id: string) {
  const db = openStore();
  db.query("DELETE FROM kick WHERE bug_record = ?").run(id);
  db.query("DELETE FROM bug_record WHERE id = ?").run(id);
  db.close();
}

// ── R1: the promote verb (the operator's step, now a supported command) ──────
test("test_promote_open_row", async () => {
  const { verbPromote } = await import("../src/cli-verbs");
  const db = openStore();
  const id = "pr:w2-promote:1";
  db.query("DELETE FROM pr_node WHERE id = ?").run(id);
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, head_sha, state) VALUES (?,?,?,?,?,?)")
    .run(id, "w2", 1, "s-w2", HEAD40, "open");
  db.close();

  const r = await verbPromote(ROOT, id);
  expect(r.code).toBe(0);
  expect((r.out as { promoted?: string }).promoted).toBe(id);

  const db2 = openStore();
  const row = db2.query("SELECT state FROM pr_node WHERE id = ?").get(id) as { state: string };
  expect(row.state).toBe("ready_to_merge");
  db2.query("DELETE FROM pr_node WHERE id = ?").run(id);
  db2.close();
});

test("test_promote_refuses_non_open", async () => {
  const { verbPromote } = await import("../src/cli-verbs");
  const db = openStore();
  const id = "pr:w2-promote:2";
  db.query("DELETE FROM pr_node WHERE id = ?").run(id);
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, head_sha, state) VALUES (?,?,?,?,?,?)")
    .run(id, "w2", 2, "s-w2", HEAD40, "ready_to_merge");
  db.close();

  const r = await verbPromote(ROOT, id);
  expect(r.code).toBe(1);
  expect(String((r.out as { refused?: string }).refused)).toContain("NOT-PROMOTABLE");

  // a missing row and a missing head_sha are their own named refusals
  expect((await verbPromote(ROOT, "pr:w2-absent:9")).out).toMatchObject({ refused: "NO-SUCH-PR" });
  const db3 = openStore();
  db3.query("INSERT INTO pr_node(id, project, pr_number, session_id, head_sha, state) VALUES (?,?,?,?,?,?)")
    .run("pr:w2-nosha:3", "w2", 3, "s-w2", null, "open");
  db3.close();
  expect((await verbPromote(ROOT, "pr:w2-nosha:3")).out).toMatchObject({ refused: "NO-HEAD-SHA" });

  const db4 = openStore();
  db4.query("DELETE FROM pr_node WHERE id = ?").run(id);
  db4.query("DELETE FROM pr_node WHERE id = ?").run("pr:w2-nosha:3");
  db4.close();
});

// ── R7: the preflight REFUSES a worktree with no fence job ──────────────────
test("test_preflight_refuses_no_spec", async () => {
  const wt = mkdtempSync(join(tmpdir(), "w2-wt-"));
  mkdirSync(join(wt, "no-spec"), { recursive: true });
  const run = (root: string) => Bun.spawnSync(["bash", join(ROOT, "gates/rt-preflight.sh")], {
    env: { ...process.env, UPPER_WORKTREE_ROOT: root }, stderr: "pipe", stdout: "pipe",
  });
  // a worktree with NO SPEC.md -> exit 1 (the named refusal)
  const bad = run(wt);
  expect(bad.exitCode).toBe(1);
  expect(bad.stderr.toString()).toContain("FENCE-NO-SPEC");
  // the same tree WITH a SPEC.md -> the fence check passes (exit 0)
  // UPDATED (W20, ship gate HIGH): the gate now requires the SAME `artifact:` line the
  // FENCE requires (verdict.ts) — a readable non-blank SPEC.md alone was a false PASS.
  writeFileSync(join(wt, "no-spec", "SPEC.md"), "# spec\njob: w2\nartifact: src/x.ts\n");
  expect(run(wt).exitCode).toBe(0);
});

// ── R9: kick() is WIRED — the verb reaches the real dossier gate ────────────
test("test_kick_verb_is_wired", async () => {
  const { verbKick } = await import("../src/cli-verbs");
  const dir = mkdtempSync(join(tmpdir(), "w2-kick-"));
  writeFileSync(join(dir, "dossier.md"), "# dossier\nfix the thing\n");
  writeFileSync(join(dir, "origin.json"), JSON.stringify({ commit: "c0ffee" }));
  writeFileSync(join(dir, "manifest.sha16"), "deadbeefdeadbeef\n"); // WRONG hash
  const bid = "w2-bug-tamper";
  putBug(bid, dir);

  const r = await verbKick(ROOT, bid, "direct");
  // the verb reached kick() THROUGH the real adapter (real readFile) and the
  // dossier-hash gate refused — proving the wiring, with zero side effects.
  expect(r.code).toBe(1);
  expect(String((r.out as { error?: string }).error)).toContain("DOSSIER-TAMPER");
  // an unknown bug is its own named refusal (never KICK-ADAPTER-UNWIRED)
  expect((await verbKick(ROOT, "w2-no-such-bug")).out).toMatchObject({ refused: "NO-SUCH-BUG" });
  delBug(bid);
});

test("test_kick_direct_records_the_kick", async () => {
  const dir = mkdtempSync(join(tmpdir(), "w2-kick2-"));
  const md = "# dossier\nreal\n";
  const oj = JSON.stringify({ commit: "c0ffee" });
  writeFileSync(join(dir, "dossier.md"), md);
  writeFileSync(join(dir, "origin.json"), oj);
  const sha = dossierSha16(md, oj);
  writeFileSync(join(dir, "manifest.sha16"), sha + "\n");
  const bid = "w2-bug-ok";
  putBug(bid, dir);

  const db = openStore();
  const res = await kick(db, {
    sessionAlive: async () => "dead" as const,
    send: async () => ({ ok: false }),
    spawn: async () => ({ sessionId: "spawned-x" }),
    openBranch: async () => ({ ok: true }),
    readFile: async (p: string) => await Bun.file(p).text(),
  }, { bugId: bid, projectId: "p", originSession: null, originCommit: "c0ffee", dossierPath: dir, mode: "direct" });

  expect(res.mode).toBe("direct");
  expect(res.target).toBe(`fix/${bid}`);
  expect(res.dossierSha16).toBe(sha);
  const kr = db.query("SELECT outcome FROM kick WHERE bug_record = ?").get(bid) as { outcome: string } | null;
  expect(kr?.outcome).toBe("branched");     // the kick ledger row landed
  db.close();
  delBug(bid);
});
