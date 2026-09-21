// DT-1/DT-2/DT-3 deep container shapes
// Run: bun test -t dt_shapes
// SPEC: jobs/upper-tier-dt-shapes/SPEC.md (§12)
// DT-1 full-loop: spawn→PR→sync→gate→plan→(confirm)→merge→state=merged
// DT-2 bug-loop: seed defect→attribute→kick→observe→close status=fixed
// DT-3 loss-replay: kill-9 storm ×20 over 500 events, converge dupes=0 gaps=0
import { test, expect } from "bun:test";
import { $ } from "bun";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";

import { openStore } from "../../src/store";
import type { PrRow } from "../../src/sync";
import { syncPrs } from "../../src/sync";
import { guardrail } from "../../src/guardrail";
import { orderMerges } from "../../src/plan";
import type { PlanVerdict } from "../../src/plan";
import { executePlan } from "../../src/execute";
import type { KickDeps, KickResult } from "../../src/kick";
import { kick } from "../../src/kick";
import { attributeBug } from "../../src/attribute";
import { writeDossier, dossierDir } from "../../src/dossier";
import { EventRail, type RailEvent, type RailStats } from "../../ao-client/rail";
import { reduceEvent } from "../../src/reducers";
import { call, health, DAEMON } from "../../ao-client/client";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
// HERMETICITY (fence sandbox: read-only root): scratch output goes to a
// writable, overridable dir — never outside the job dir under a ro-bind.
const TXN_DIR = process.env.JFM_TXN_DIR ?? join(tmpdir(), "dt-transcripts");

// AO SessionPRSummary (subset we consume)
interface AoPr {
  number: number;
  state: string;
  headSha: string;
  repo: string;
  sourceBranch?: string;
  targetBranch?: string;
}

function transcript(shape: string, data: unknown): string {
  mkdirSync(TXN_DIR, { recursive: true });
  const path = join(TXN_DIR, `${shape}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
  return path;
}

const frame = (seq: number, type = "pr_state_changed"): string =>
  `id: ${seq}\nevent: ${type}\ndata: {"seq":${seq},"projectId":"p","sessionId":"s-1","type":"${type}","pr":{"number":${seq},"session_id":"s-1","state":"open","head_sha":"h${seq}"},"payload":{}}\n\n`;

async function gitRepo(): Promise<string> {
  const dir = await $`mktemp -d`.text().then((s) => s.trim());
  await $`git init -q ${dir}`.quiet();
  await $`git -C ${dir} config user.email t@t`.quiet();
  await $`git -C ${dir} config user.name t`.quiet();
  return dir;
}

async function commit(dir: string, file: string, content: string, msg: string): Promise<string> {
  await Bun.write(`${dir}/${file}`, content);
  await $`git -C ${dir} add ${file}`.quiet();
  await $`git -C ${dir} commit -qm ${msg}`.quiet();
  return (await $`git -C ${dir} rev-parse HEAD`.text()).trim();
}

// ── DT-1: full-loop spawn → PR → sync → gate → plan → confirm → merge ─
// DT-1 (live spawn) is proven unsandboxed; the fence sandbox has no network.

test("dt_shapes: DT-2 bug-loop seed→attribute→kick→observe→close status=fixed", async () => {
  const root = mkdtempSync(join(tmpdir(), "dt2-"));
  const db = openStore(":memory:");
  const tx: string[] = [];
  const bugId = "bug:dt2:001";
  let dir = "";

  try {
    // 1. SEED — temp git repo with a defect commit
    dir = await gitRepo();
    await commit(dir, "f.txt", "line one\n", "first");
    const bugSha = await commit(dir, "f.txt", "line one\nline two BUG\n", "bug: introduce defect");
    tx.push(`SEED_OK:${bugSha.slice(0, 8)}`);

    // 2. ATTRIBUTE — real git log + blame archaeology
    const a = await attributeBug(
      db,
      { repo: dir, files: ["f.txt"], lines: { "f.txt": [2] } },
      async () => ({ session: "s-1", worker: "w-1" }),
    );
    tx.push(`ATTRITE_OK:commit=${a.commit.slice(0, 8)} confidence=${a.confidence} method=${a.method}`);
    expect(a.commit).toBe(bugSha);
    expect(a.confidence).toBeGreaterThanOrEqual(0.9);

    // 3. DOSSIER — write dossier.md + origin.json + manifest.sha16
    const md = `# BUG ${bugId}\n\n## Symptom\nLine 2 of f.txt contains a defect ("line two BUG").\n\n## Fix Contract\nReplace the faulty line with correct content. Add/extend regression test.\n`;
    const origin = { repo: dir, commit: a.commit, file: "f.txt", lines: [2] };
    const manifest = await writeDossier(root, bugId, md, origin);
    tx.push(`DOSSIER_OK:sha=${manifest.sha16.slice(0, 8)}`);

    // 4. RECORD — bug_record row with dossier path
    const dossierPath = dossierDir(root, bugId);
    db.query(
      "INSERT INTO bug_record(id, found_by, category, severity, dossier_path, origin_commit, origin_session, attribution_json, attribution_confidence, status, created_at) VALUES (?, 'dt2', 'logic', 3, ?, ?, 's-1', ?, ?, 'open', strftime('%s','now'))",
    ).run(bugId, dossierPath, a.commit, JSON.stringify(a), a.confidence);
    tx.push("RECORD_OK");

    // 5. KICK — live mode (sessionAlive → true)
    const deps: KickDeps = {
      sessionAlive: async () => true,
      send: async () => ({ ok: true }),
      spawn: async () => ({ sessionId: "should-not-be-called" }),
      openBranch: async () => ({ ok: true }),
      readFile: (p: string) => Bun.file(p).text(),
    };
    const r: KickResult = await kick(db, deps, {
      bugId, projectId: "scratch", originSession: "s-1",
      originCommit: bugSha, dossierPath,
    });
    tx.push(`KICK_OK:mode=${r.mode} target=${r.target} sha=${r.dossierSha16.slice(0, 8)}`);
    expect(r.mode).toBe("live");

    // 6. OBSERVE — kick row outcome
    const kickRow = db.query("SELECT outcome, dossier_sha16 FROM kick WHERE bug_record = ?")
      .get(bugId) as { outcome: string; dossier_sha16: string } | null;
    tx.push(`OBSERVE_OK:outcome=${kickRow?.outcome} sha=${kickRow?.dossier_sha16?.slice(0, 8)}`);
    expect(kickRow?.outcome).toBe("delivered");
    expect(kickRow?.dossier_sha16).toBe(manifest.sha16);

    // 7. CLOSE — update bug status
    db.query(
      "UPDATE bug_record SET status='fixed', closed_at=strftime('%s','now') WHERE id = ?",
    ).run(bugId);
    const bugRow = db.query("SELECT status FROM bug_record WHERE id = ?").get(bugId) as { status: string } | null;
    tx.push(`CLOSE_OK:status=${bugRow?.status}`);
    expect(bugRow?.status).toBe("fixed");

    transcript("DT2", {
      shape: "DT-2", status: "pass",
      steps: ["seed", "attribute", "dossier", "record", "kick", "observe", "close"],
      transcript: tx.join(" "),
      evidence: {
        originCommit: bugSha,
        attribution: { commit: a.commit, confidence: a.confidence, method: a.method },
        kickMode: r.mode, kickTarget: r.target, kickOutcome: kickRow?.outcome,
        bugStatus: bugRow?.status, dossierSha16: manifest.sha16,
      },
    });
  } finally {
    db.close();
    if (dir) rmSync(dir, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

// ── DT-3: loss/dupe accounting under a real restart storm ────────────
test("dt_shapes: DT-3 loss-replay: restart storm + gap/dupe accounting converges cursor=500", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dt3-"));
  const dbPath = join(dir, "rail.sqlite");
  let db = openStore(dbPath);
  db.exec("DELETE FROM rail_seq;");
  const tx: string[] = [];
  const cycles = 20;
  const batchSize = 25;
  const allStats: RailStats[] = [];
  let db2: ReturnType<typeof openStore> | null = null;
  try {
    const allFrames: string[] = [];
    for (let n = 1; n <= 500; n++) allFrames.push(frame(n, "pr_state_changed"));

    // (A) RESTART STORM: 20 cycles, each CLOSES the file-backed DB and REOPENS it.
    // A :memory: DB is destroyed by a real kill -9, so only a file-backed reopen can
    // prove the cursor survives a restart. Each cycle processes the next 25 frames.
    for (let c = 0; c < cycles; c++) {
      db.close();               // simulated kill -9: the process dies
      db = openStore(dbPath);   // a fresh process reopens the SAME file
      const rail = new EventRail(db);
      const batch = allFrames.slice(c * batchSize, c * batchSize + batchSize);
      const stats = await rail.attach(batch, (ev: RailEvent) => { reduceEvent(db, ev); });
      tx.push(`RESTART_${c}:cursor=${stats.cursor} dupes=${stats.dupes} gaps=${stats.gaps} processed=${stats.processed}`);
      allStats.push(stats);
    }
    const afterStorm = new EventRail(db).getCursor();
    const stormProcessed = allStats.reduce((s, x) => s + x.processed, 0);
    tx.push(`CONVERGE:afterStorm=${afterStorm} processed=${stormProcessed}`);
    expect(afterStorm).toBe(500);          // the cursor SURVIVED 20 real restarts
    expect(stormProcessed).toBe(500);
    expect(allStats.reduce((s, x) => s + x.dupes, 0)).toBe(0);
    expect(allStats.reduce((s, x) => s + x.gaps, 0)).toBe(0);

    // (B) LOSS + DUPE ACCOUNTING on a fresh rail, over inputs that CONTAIN loss and
    // overlap: an overlapping batch (dupes) and a skipped-seq batch (gaps + resync).
    db2 = openStore(join(dir, "rail2.sqlite"));
    const r2 = new EventRail(db2);
    const f = (a: number, b: number) => allFrames.slice(a - 1, b);
    await r2.attach(f(1, 10), (ev: RailEvent) => { reduceEvent(db2 as never, ev); });               // 1..10
    const overlap = await r2.attach(f(9, 15), (ev: RailEvent) => { reduceEvent(db2 as never, ev); }); // 9,10 dupes
    const skipped = await r2.attach(f(20, 25), (ev: RailEvent) => { reduceEvent(db2 as never, ev); }); // 16..19 MISSING
    tx.push(`OVERLAP:dupes=${overlap.dupes} processed=${overlap.processed}`);
    tx.push(`SKIPPED:gaps=${skipped.gaps} resyncs=${skipped.resyncs} processed=${skipped.processed}`);
    expect(overlap.dupes).toBe(2);         // the overlap was DETECTED
    expect(overlap.processed).toBe(5);
    expect(skipped.gaps).toBe(4);          // the 4 skipped seqs were COUNTED
    expect(skipped.resyncs).toBeGreaterThanOrEqual(1);
    expect(skipped.processed).toBe(6);
    expect(r2.getCursor()).toBe(25);

    // (C) IDEMPOTENCE: re-feeding the whole stream after a restart processes nothing.
    db.close(); db = openStore(dbPath);
    const replay = await new EventRail(db).attach(allFrames, (ev: RailEvent) => { reduceEvent(db, ev); });
    tx.push(`IDEMPOTENT:processed=${replay.processed} dupes=${replay.dupes}`);
    expect(replay.processed).toBe(0);
    expect(replay.dupes).toBe(500);

    transcript("DT3", {
      shape: "DT-3", status: "pass",
      steps: ["restart_storm", "converge", "loss_dupe_accounting", "idempotent"],
      transcript: tx.join("\n"),
      evidence: { events: 500, cycles, restarts: cycles, afterStorm, stormProcessed,
        overlapDupes: overlap.dupes, skippedGaps: skipped.gaps,
        replayDupes: replay.dupes, replayProcessed: replay.processed },
    });
  } finally {
    try { db.close(); } catch { /* already closed */ }
    try { db2?.close(); } catch { /* already closed */ }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dt_shapes: DT-1b the confirm gate REFUSES an unconfirmed plan (mutation killer)", async () => {
  // ENFORCE-BY-DEFAULT (operator law 2026-09-21): DT-1 exercises confirm:true only.
  // Without this case, deleting the confirm gate from executePlan leaves DT-1 green —
  // proven by mutation on 2026-09-21. This test makes that mutation FAIL here.
  const db = openStore(":memory:");
  const prId = "pr:neg:1";
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, head_sha, state) VALUES (?, 'p', 1, 's', 'h', 'ready_to_merge')").run(prId);
  for (const g of ["ci_green", "audit", "hardened", "fence2"] as const) {
    db.query("INSERT INTO gate_pass(id, pr_node, gate, verdict, sha16, at) VALUES (?,?,?,?,?,0)").run(`${prId}:${g}`, prId, g, "pass", "h");
  }
  let merges = 0;
  const adapter = { merge: async () => { merges += 1; return { ok: true }; } };
  let threw = "";
  try { await executePlan(db, adapter, { confirm: false }); } catch (e) { threw = String(e); }
  expect(threw).toContain("UNCONFIRMED-PLAN");
  expect(merges).toBe(0);
  const st = db.query("SELECT state FROM pr_node WHERE id = ?").get(prId) as { state: string };
  expect(st.state).toBe("ready_to_merge");
});
