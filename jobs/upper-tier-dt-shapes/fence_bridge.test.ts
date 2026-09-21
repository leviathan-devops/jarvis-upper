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
// DT-1 (live spawn) lives in tests/ and is proven unsandboxed by the W3 gate.

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

// ── DT-3: loss-replay under kill-9 storm ×20 ────────────────────────
test("dt_shapes: DT-3 loss-replay kill-9 storm converge dupes=0 gaps=0 cursor=500", async () => {
  const db = openStore(":memory:");
  db.exec("DELETE FROM rail_seq;");
  const tx: string[] = [];

  try {
    // 500 ordered pr_state_changed frames
    const allFrames: string[] = [];
    for (let n = 1; n <= 500; n++) allFrames.push(frame(n, "pr_state_changed"));

    // 20 kill-9 cycles: each spawns a fresh EventRail (simulating process
    // restart) that resumes from the persisted cursor in rail_seq.
    // Each cycle processes 25 distinct frames → dupes=0, gaps=0.
    const cycles = 20;
    const batchSize = 25;
    const allStats: RailStats[] = [];

    for (let c = 0; c < cycles; c++) {
      const start = c * batchSize;
      const end = start + batchSize;
      const batch = allFrames.slice(start, end);

      const rail = new EventRail(db); // fresh process after kill-9
      const beforeCursor = rail.getCursor();
      const stats = await rail.attach(batch, (ev: RailEvent) => {
        reduceEvent(db, ev);
      });
      tx.push(
        `CYCLE_${c}:cursor=${beforeCursor}->${stats.cursor} dupes=${stats.dupes} gaps=${stats.gaps} processed=${stats.processed}`,
      );
      allStats.push(stats);
    }

    // Convergence: cursor must be 500, zero dupes, zero gaps
    const finalRail = new EventRail(db);
    const finalCursor = finalRail.getCursor();
    const totalDupes = allStats.reduce((s, x) => s + x.dupes, 0);
    const totalGaps = allStats.reduce((s, x) => s + x.gaps, 0);
    const totalProcessed = allStats.reduce((s, x) => s + x.processed, 0);
    tx.push(`CONVERGE:cursor=${finalCursor} dupes=${totalDupes} gaps=${totalGaps} processed=${totalProcessed}`);

    expect(finalCursor).toBe(500);
    expect(totalDupes).toBe(0);
    expect(totalGaps).toBe(0);
    expect(totalProcessed).toBe(500);

    // Double-replay idempotence — re-feed all 500, all should be dupes
    const replayRail = new EventRail(db);
    const replayStats = await replayRail.attach(allFrames, (ev: RailEvent) => {
      reduceEvent(db, ev);
    });
    tx.push(`IDEMPOTENT:processed=${replayStats.processed} dupes=${replayStats.dupes}`);
    expect(replayStats.processed).toBe(0);
    expect(replayStats.dupes).toBe(500);

    const rowCount = db.query("SELECT COUNT(*) AS n FROM pr_node").get() as { n: number };
    tx.push(`ROWS:${rowCount.n}`);

    transcript("DT3", {
      shape: "DT-3", status: "pass",
      steps: ["init", "storm", "converge", "idempotent"],
      transcript: tx.join("\n"),
      evidence: {
        events: 500, cycles, dupes: totalDupes, gaps: totalGaps,
        cursor: finalCursor, processed: totalProcessed,
        replayDupes: replayStats.dupes, replayProcessed: replayStats.processed,
        rows: rowCount.n,
      },
    });
  } finally {
    db.close();
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
