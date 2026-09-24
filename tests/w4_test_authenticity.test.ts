// W4 — THE TEST-AUTHENTICITY SUITE (red-team audit R15).
// These tests exercise the REAL fence2.py, REAL git, and a REAL ledger — no result
// injection. The only seam is the FENCE_LEDGER env (isolation), never the verdict.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verify } from "../src/verdict";

const FENCE = "/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py";
const SESSION = "w4-session";

function g(dir: string, args: string[]) {
  const p = Bun.spawnSync(["git", "-C", dir, ...args], { stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode ?? -1, out: (p.stdout?.toString() ?? "").trim(), err: (p.stderr?.toString() ?? "").trim() };
}

/** Build a REAL fence job: a git worktree whose committed artifact passes the fence. */
function buildJob(): { dir: string; head: string; ledger: string; artifact: string } {
  const dir = mkdtempSync(join(tmpdir(), "w4-job-"));
  const artifact = join(dir, "artifact.txt");
  writeFileSync(artifact, "alpha\n");
  writeFileSync(join(dir, "SPEC.md"),
    `job: w4-real\nseat: fixture\nartifact: ${artifact}\nsha16: 0000000000000000\n\`\`\`done-when\ngrep -q alpha ${artifact}\n\`\`\`\n`);
  g(dir, ["init", "-q"]);
  g(dir, ["config", "user.email", "w4@test.local"]);
  g(dir, ["config", "user.name", "w4"]);
  // OUTSIDE the job dir: the fence writes this file, and a ledger inside the worktree
  // would make `git status` dirty -> the (correct) bind refuses FENCE-DIRTY-WORKTREE.
  const ledger = join(mkdtempSync(join(tmpdir(), "w4-ledger-")), "verdicts.jsonl");
  // the REAL fence stamps the artifact sha16 into the SPEC
  Bun.spawnSync(["python3", FENCE, "init", dir], { env: { ...process.env, FENCE_LEDGER: ledger }, stdout: "pipe", stderr: "pipe" });
  g(dir, ["add", "-A"]);
  g(dir, ["commit", "-q", "-m", "w4 job"]);
  const head = g(dir, ["rev-parse", "HEAD"]).out;
  return { dir, head, ledger, artifact };
}

// MEASURED: Bun.spawnSync does NOT inherit a mutated process.env (a probe child read
// "MISSING"), so the ledger path MUST be passed as an EXPLICIT env or the fence writes
// the DEFAULT (production) ledger — which is how the first cut polluted it.
const fenceEnv = (ledger: string) => ({ ...process.env, FENCE_LEDGER: ledger });

function runFenceReal(dir: string, ledger: string) {
  const inv = (Bun.spawnSync(["python3", FENCE, "invariant-sha", dir], { stdout: "pipe", stderr: "pipe", env: fenceEnv(ledger) }).stdout?.toString() ?? "").trim().split("\n").pop() ?? "";
  const p = Bun.spawnSync(["python3", FENCE, "adjudicate", dir, "--expect-spec-sha", inv], { stdout: "pipe", stderr: "pipe", env: fenceEnv(ledger) });
  return { code: p.exitCode ?? -1, inv, out: (p.stdout?.toString() ?? "").trim() };
}

/** The review seam: a live approval needs a LIVE AO session, so the review payload is
 *  the ONE injected input. The FENCE is never injected — it runs for real (the R15 point). */
const greenReviews = (head: string) => async () => ({
  reviewerHarness: "muse",
  reviews: [{ status: "approved", targetSha: head }],
  runs: [],
});

/** the DEFAULT runFence shape, but with the ledger redirected (isolation, NOT result
 *  injection — the REAL fence runs; only FENCE_LEDGER differs). */
function runFenceEnv(ledger: string) {
  return async (argv: string[]) => {
    const p = Bun.spawn(["python3", ...argv], { stdout: "pipe", stderr: "pipe", env: fenceEnv(ledger) });
    const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
    const code = await p.exited;
    return { code: code ?? -1, stdout: out, stderr: err };
  };
}

// ── R15: a REAL fence run reaches VERIFIED (fence+ledger+bind, all real) ─────
test("test_real_fence_verified", async () => {
  const j = buildJob();
  const fr = runFenceReal(j.dir, j.ledger);
  expect(fr.code).toBe(0);                                  // the REAL fence adjudicated PASS
  expect(fr.out).toContain('"verdict":"PASS"');
  expect(readFileSync(j.ledger, "utf8")).toContain("w4-real");   // the REAL ledger row landed

  // verify() with the DEFAULT runFence (spawns the REAL fence) + the REAL ledger.
  {
    const r = await verify({ jobDir: j.dir, headSha: j.head, sessionId: SESSION, ledgerPath: j.ledger, runFence: runFenceEnv(j.ledger), fetchReviews: greenReviews(j.head) });
    expect(r.verdict).toBe("VERIFIED");
    expect(r.sources.fence.reason).toBe("FENCE-GREEN");
    expect(r.sources.fence.ledgerVerdict).toBe("PASS");      // the ledger binding held
    expect(r.reasons).toEqual([]);
  }
});

// ── R15: a REAL drift REFUSES (the artifact no longer matches HEAD) ──────────
test("test_real_fence_refuses", async () => {
  const j = buildJob();
  runFenceReal(j.dir, j.ledger);
  // flip the artifact ON DISK after the commit -> it no longer matches HEAD
  writeFileSync(j.artifact, "beta\n");
  {
    const r = await verify({ jobDir: j.dir, headSha: j.head, sessionId: SESSION, ledgerPath: j.ledger, runFence: runFenceEnv(j.ledger), fetchReviews: greenReviews(j.head) });
    expect(r.verdict).toBe("UNVERIFIED");
    // the REAL fence/bind caught the drift (the SPEC sha check OR the byte-identical bind)
    expect(r.reasons.join("|")).toMatch(/FENCE-FAILED|FENCE-ARTIFACT-DRIFT|FENCE-DIRTY-WORKTREE/);
  }
});

// ── R15: the ledger binding — the SPEC's job name is the needle ──────────────
test("test_real_ledger_binding", async () => {
  const j = buildJob();
  const fr = runFenceReal(j.dir, j.ledger);
  expect(fr.code).toBe(0);
  // the ledger row the REAL fence wrote names the SPEC's job
  const rows = readFileSync(j.ledger, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const mine = rows.filter((r) => r.job === "w4-real");
  expect(mine.length).toBeGreaterThanOrEqual(1);
  expect(mine[mine.length - 1].verdict).toBe("PASS");
  // and verify() binds it: a mismatched head must NOT read green off a good row
  const r = await verify({ jobDir: j.dir, headSha: "f".repeat(40), sessionId: SESSION, ledgerPath: j.ledger, runFence: runFenceEnv(j.ledger), fetchReviews: greenReviews("f".repeat(40)) });
  expect(r.verdict).toBe("UNVERIFIED");
  expect(r.reasons.join("|")).toContain("FENCE-HEAD-MISMATCH");
});
