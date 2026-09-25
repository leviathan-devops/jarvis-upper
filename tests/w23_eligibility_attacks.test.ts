// W23 — THE RED->GREEN ATTACK BATTERY on the eligibility chain (my own adversarial pass).
// Every attack must be REFUSED; the two GitHub non-blocking conclusions must PASS.
import { test, expect } from "bun:test";
import { guardrailRemote } from "../src/guardrail";
import { GITHUB_JOB_CONTEXTS } from "../src/status-contract";

const SHA = "a".repeat(40);
const mk = (statuses: unknown[], runs: unknown[]) => (async (url: unknown) => {
  const u = String(url);
  if (u.includes("/statuses")) return new Response(JSON.stringify(statuses), { status: 200 });
  if (u.includes("/check-runs")) return new Response(JSON.stringify({ total_count: runs.length, check_runs: runs }), { status: 200 });
  return new Response("{}", { status: 404 });
}) as unknown as typeof fetch;
const ok2 = [{ context: "factory/fence2", state: "success" }, { context: "factory/verdict", state: "success" }];
const allGreen = GITHUB_JOB_CONTEXTS.map((n) => ({ name: n, conclusion: "success", completed_at: "2026-01-01T00:00:00Z" }));
const run = (st: unknown[], rn: unknown[]) => guardrailRemote({ owner: "o", repo: "r", sha: SHA, token: "t", fetchImpl: mk(st, rn) });

test("test_eligibility_red_never_reads_green", async () => {
  const attacks: [string, unknown[], unknown[]][] = [
    ["a failing check-run", ok2, allGreen.map((r, i) => i === 0 ? { ...r, conclusion: "failure" } : r)],
    ["a check-run still RUNNING (null conclusion)", ok2, allGreen.map((r, i) => i === 0 ? { ...r, conclusion: null } : r)],
    ["a MISSING check-run", ok2, allGreen.slice(1)],
    ["empty check-runs", ok2, []],
    ["a RED status masking a green check", [{ ...ok2[0], state: "failure" }, ok2[1]], allGreen],
    ["a re-run whose LATEST is a failure", ok2, [...allGreen, { name: GITHUB_JOB_CONTEXTS[0], conclusion: "failure", completed_at: "2027-01-01T00:00:00Z" }]],
    ["a queued re-run (no timestamps at all)", ok2, [...allGreen, { name: GITHUB_JOB_CONTEXTS[0], conclusion: "failure" }]],
  ];
  for (const [label, st, rn] of attacks) {
    const e = await run(st, rn);
    expect({ label, ok: e.ok }).toEqual({ label, ok: false });   // NEVER green
  }
});

test("test_eligibility_github_nonblocking_pass", async () => {
  // GitHub treats `neutral` and `skipped` as PASSING for a required check.
  for (const c of ["neutral", "skipped"]) {
    const e = await run(ok2, allGreen.map((r, i) => i === 0 ? { ...r, conclusion: c } : r));
    expect({ c, ok: e.ok }).toEqual({ c, ok: true });
  }
});

test("test_eligibility_rerun_latest_wins", async () => {
  // a re-run adds a NEW check run — the LATEST wins (fail->success must unblock).
  const e = await run(ok2, [...allGreen, { name: GITHUB_JOB_CONTEXTS[0], conclusion: "failure", completed_at: "2025-01-01T00:00:00Z" }]);
  expect(e.ok).toBe(true);
});
