// W19 — THE OPERATIONAL GAP: the 6 gates/* contexts are CHECK RUNS, not commit
// statuses. Without reading /check-runs, ci_green was ALWAYS fail and NO PR could
// ever be eligible — the factory could never do its job.
import { test, expect } from "bun:test";
import { guardrailRemote } from "../src/guardrail";
import { GITHUB_JOB_CONTEXTS } from "../src/status-contract";

const SHA = "a".repeat(40);
const statuses = () => new Response(JSON.stringify([
  { context: "factory/fence2", state: "success" },
  { context: "factory/verdict", state: "success" },
]), { status: 200 });
const checkRuns = (concl: (n: string, i: number) => string) => new Response(JSON.stringify({
  total_count: GITHUB_JOB_CONTEXTS.length,
  check_runs: GITHUB_JOB_CONTEXTS.map((n, i) => ({ name: n, conclusion: concl(n, i), completed_at: "2026-01-01T00:00:00Z" })),
}), { status: 200 });
const mk = (cr: Response) => (async (url: unknown) => {
  const u = String(url);
  if (u.includes("/statuses")) return statuses();
  if (u.includes("/check-runs")) return cr;
  return new Response("{}", { status: 404 });
}) as unknown as typeof fetch;

test("test_remote_reads_check_runs_too", async () => {
  const e = await guardrailRemote({ owner: "o", repo: "r", sha: SHA, token: "t", fetchImpl: mk(checkRuns(() => "success")) });
  expect(e.ok).toBe(true);
  expect(e.missing).toEqual([]);
  expect(Object.keys(e.states).length).toBe(8);          // ALL 8, not just the 2 statuses
});

test("test_remote_bad_check_run_blocks", async () => {
  const e = await guardrailRemote({ owner: "o", repo: "r", sha: SHA, token: "t", fetchImpl: mk(checkRuns((_n, i) => (i === 0 ? "failure" : "success"))) });
  expect(e.ok).toBe(false);
  expect(e.reasons.join("|")).toContain("REMOTE-GATE-RED");
  expect(e.missing.length).toBe(1);
});

test("test_remote_latest_check_run_supersedes", async () => {
  // a re-run adds a NEW check run for the same name — the LATEST must win.
  const cr = new Response(JSON.stringify({
    total_count: GITHUB_JOB_CONTEXTS.length + 1,
    check_runs: [
      { name: "gates/test", conclusion: "failure", completed_at: "2026-01-01T00:00:00Z" },
      ...GITHUB_JOB_CONTEXTS.filter((n) => n !== "gates/test").map((n) => ({ name: n, conclusion: "success", completed_at: "2026-01-01T00:00:00Z" })),
      { name: "gates/test", conclusion: "success", completed_at: "2026-01-01T01:00:00Z" },   // the RE-RUN
    ],
  }), { status: 200 });
  const e = await guardrailRemote({ owner: "o", repo: "r", sha: SHA, token: "t", fetchImpl: mk(cr) });
  expect(e.ok).toBe(true);       // the re-run's success supersedes the failure
});

test("test_spawn_attachments_are_base64", async () => {
  // FIXED (FOUND BY FIRING THE KICK LIVE): the daemon rejected raw bytes with
  // `attachment data is not valid base64`. AttachmentInput.data is BASE64.
  const { daemonKickDeps } = await import("../src/kick-adapter");
  const calls: { op: string; opts: { body?: { attachments?: { data: string; mimeType: string }[] } } }[] = [];
  const callFn = (async (op: string, opts: never) => { calls.push({ op, opts }); return { session: { id: "s" } }; }) as never;
  const deps = daemonKickDeps({ callFn });
  await deps.spawn({ projectId: "p", brief: "b", attachments: [{ name: "dossier.md", content: "# dossier\nplain text\n" }] });
  const att = calls[0].opts.body?.attachments?.[0];
  expect(att).toBeDefined();
  expect(att!.data).toBe(Buffer.from("# dossier\nplain text\n", "utf8").toString("base64"));
  expect(Buffer.from(att!.data, "base64").toString("utf8")).toContain("# dossier");   // round-trips
});
