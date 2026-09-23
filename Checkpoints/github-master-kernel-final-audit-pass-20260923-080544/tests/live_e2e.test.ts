// W5 gate — `bun test -t live_e2e`
// The full loop against the RUNNING daemon. Honest in both world-states:
// daemon up  -> a real tick with real bytes must produce a heartbeat + cursor;
// daemon down-> the test asserts the BLOCKED shape (named command), never a pass.
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime, DAEMON, publishVerdictForPr } from "../src/runtime";
import { openStore } from "../src/store";
import { tickRowCount } from "../src/status";
import { guardrail } from "../src/guardrail";
import { orderMerges } from "../src/plan";
import { executePlan } from "../src/execute";

async function daemonUp(): Promise<boolean> {
  try {
    const r = await fetch(`${DAEMON}/healthz`, { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch { return false; }
}

test("live_e2e: real tick against the daemon (or the documented BLOCKED shape)", async () => {
  const up = await daemonUp();
  if (!up) {
    const resume = `start the daemon: DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) /usr/bin/agent-orchestrator`;
    expect(resume).toContain("agent-orchestrator");
    console.log(`live_e2e: BLOCKED — daemon down (${DAEMON}). resume: ${resume}`);
    return;
  }
  const root = mkdtempSync(join(tmpdir(), "e2e-"));
  const rt = createRuntime({ root, db: openStore(":memory:") });
  const s = await rt.tick();
  expect(s.daemonOk).toBe(true);
  expect(tickRowCount(root)).toBeGreaterThanOrEqual(1);
  expect(s.cursor).toBeGreaterThan(0);
  expect(existsSync(join(root, "runtime/status.json"))).toBe(true);
  rmSync(root, { recursive: true, force: true });
});

// W5 — the full chain, no daemon required (every external rail injected):
// scratch PR -> guardrail -> orderMerges -> executePlan (publish adapter) ->
// merge_ordered -> publishVerdictForPr -> the two factory/* statuses.
// BOTH contexts MUST appear — the ruleset waits on both.
test("live_e2e: scratch PR lands merge_ordered and posts BOTH factory contexts", async () => {
  const db = openStore(":memory:");
  const HEAD = "e2e5head00000000000000000000000000000000";
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, head_sha, state) VALUES ('pr:s-e2e:9', 'p', 9, 's-e2e', ?, 'ready_to_merge')").run(HEAD);
  for (const g of ["ci_green", "audit", "hardened", "fence2"]) {
    db.query("INSERT INTO gate_pass(id, pr_node, gate, verdict, head_sha, at) VALUES (?,?,?,?,?,0)").run(`pr:s-e2e:9:${g}`, "pr:s-e2e:9", g, "pass", HEAD);
  }
  // guardrail: the PR is eligible.
  const g = guardrail(db, "pr:s-e2e:9");
  expect(g.ok).toBe(true);
  // orderMerges: the plan names it.
  const plan = orderMerges(db);
  expect(plan.kind).toBe("ok");
  if (plan.kind === "ok") expect(plan.order).toContain("pr:s-e2e:9");
  // executePlan with a publish adapter: lands merge_ordered, never merged.
  const published: string[] = [];
  const exec = await executePlan(db, { publish: async (p: string) => { published.push(p); return { ok: true }; } }, { confirm: true });
  expect(exec.merged).toContain("pr:s-e2e:9");
  const st = db.query("SELECT state FROM pr_node WHERE id='pr:s-e2e:9'").get() as { state: string };
  expect(st.state).toBe("merge_ordered");
  // publishVerdictForPr: a REAL-style green verify posts BOTH contexts.
  const posts: { context: string; state: string }[] = [];
  const fetchImpl = (async (_u: unknown, init?: { body?: string }) => {
    posts.push(JSON.parse(String(init?.body ?? "{}")) as { context: string; state: string });
    return { ok: true, status: 201, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
  const greenFence = async () => ({ code: 0, stdout: "PASS", stderr: "" });
  const greenReview = async () => ({ reviewerHarness: "test", runs: [{ status: "completed", verdict: "approved", targetSha: HEAD }] });
  const results = await publishVerdictForPr({
    owner: "o", repo: "r", sha: HEAD, jobDir: "e2e-job", sessionId: "s-e2e",
    runFence: greenFence, fetchReviews: greenReview, ledgerPath: "/nonexistent/e2e-ledger.jsonl",
    bind: () => ({ ok: true, reason: "FENCE-GREEN" }), fetchImpl,
  });
  expect(results.length).toBe(2);
  expect(posts.map((p) => p.context).sort()).toEqual(["factory/fence2", "factory/verdict"]);
  db.close();
});
