// W1 gate — `bun test -t two_source_verdict`
// THE TWO-SOURCE VERDICT LAW. Adversarial first: the REAL PR #1 must come back
// UNVERIFIED with both reasons named. A test that could pass with the substrate
// down would be an escape hatch (the pin's violation law) — so the live case
// THROWS when the daemon is unreachable instead of degrading to a pass.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verify, APPROVING_VERDICTS, type VerifyOpts } from "../src/verdict";

const JOB = "/home/leviathan/JARVIS_WORKSPACE/jarvis-upper/jobs/upper-tier-dt-shapes";
const SESSION = "jarvis-upper-2";
const HEAD = "732083e1e7890000000000000000000000000000";

function tmpLedger(rows: object[]): string {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const p = join(dir, "verdicts.jsonl");
  writeFileSync(p, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  return p;
}
const greenFence = async () => ({ code: 0, stdout: "PASS", stderr: "" });
const redFence = async () => ({ code: 1, stdout: "SPEC_FORGED", stderr: "" });
const greenReview = async () => ({ reviewerHarness: "muse", reviews: [{ status: "approved", targetSha: HEAD }], runs: [{ status: "completed", verdict: "approved", targetSha: HEAD }] });
const emptyReviews = async () => ({ reviewerHarness: "muse", reviews: [], runs: [] });

test("two_source_verdict: the REAL PR #1 is UNVERIFIED with BOTH reasons named (live)", async () => {
  // substrate-down must NOT pass: the live fetch throws → the test throws.
  const r = await verify({ jobDir: JOB, headSha: HEAD, sessionId: SESSION });
  expect(r.verdict).toBe("UNVERIFIED");
  expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  expect(r.reasons.some((x) => x.startsWith("FENCE-"))).toBe(true);
  expect(r.reasons.some((x) => x.startsWith("REVIEW-"))).toBe(true);
  console.log("LIVE PR#1:", JSON.stringify({ verdict: r.verdict, reasons: r.reasons, review: r.sources.review }));
});

test("two_source_verdict: BOTH green on the SAME sha → VERIFIED (fixture)", async () => {
  const ledger = tmpLedger([{ job: "dt-shapes", verdict: "PASS", evidence: `${HEAD.slice(0, 16)}|sandbox=bwrap|spec_bound:true` }]);
  const r = await verify({ jobDir: "dt-shapes", headSha: HEAD, sessionId: SESSION, runFence: greenFence, fetchReviews: greenReview, ledgerPath: ledger });
  expect(r.verdict).toBe("VERIFIED");
  expect(r.reasons).toEqual([]);
  expect(r.sources.fence.reason).toBe("FENCE-GREEN");
  expect(r.sources.review.reason).toBe("REVIEW-GREEN");
  rmSync(ledger, { force: true });
});

test("two_source_verdict: NEGATIVE — fence only is UNVERIFIED", async () => {
  const ledger = tmpLedger([{ job: "dt-shapes", verdict: "PASS", evidence: `${HEAD.slice(0, 16)}|sandbox=bwrap` }]);
  const r = await verify({ jobDir: "dt-shapes", headSha: HEAD, sessionId: SESSION, runFence: greenFence, fetchReviews: emptyReviews, ledgerPath: ledger });
  expect(r.verdict).toBe("UNVERIFIED");
  expect(r.reasons.some((x) => x.startsWith("REVIEW-"))).toBe(true);
  rmSync(ledger, { force: true });
});

test("two_source_verdict: NEGATIVE — review only is UNVERIFIED", async () => {
  const r = await verify({ jobDir: "dt-shapes", headSha: HEAD, sessionId: SESSION, runFence: redFence, fetchReviews: greenReview, ledgerPath: "/nonexistent/ledger.jsonl" });
  expect(r.verdict).toBe("UNVERIFIED");
  expect(r.reasons.some((x) => x.startsWith("FENCE-"))).toBe(true);
});

test("two_source_verdict: NEGATIVE — a review on a STALE sha does not count", async () => {
  const ledger = tmpLedger([{ job: "dt-shapes", verdict: "PASS", evidence: `${HEAD.slice(0, 16)}|sandbox=bwrap` }]);
  const staleReview = async () => ({ reviewerHarness: "muse", runs: [{ status: "completed", verdict: "approved", targetSha: "760ad1bb42431b992d7a2168ff182e9893be5f65" }] });
  const r = await verify({ jobDir: "dt-shapes", headSha: HEAD, sessionId: SESSION, runFence: greenFence, fetchReviews: staleReview, ledgerPath: ledger });
  expect(r.verdict).toBe("UNVERIFIED");
  expect(r.reasons.some((x) => x.startsWith("REVIEW-STALE-SHA"))).toBe(true);
  rmSync(ledger, { force: true });
});

test("two_source_verdict: NEGATIVE — a stale FENCE ledger row does not count", async () => {
  const ledger = tmpLedger([{ job: "dt-shapes", verdict: "PASS", evidence: "0000000000000000|sandbox=bwrap" }]);
  const r = await verify({ jobDir: "dt-shapes", headSha: HEAD, sessionId: SESSION, runFence: greenFence, fetchReviews: greenReview, ledgerPath: ledger });
  expect(r.verdict).toBe("UNVERIFIED");
  expect(r.reasons.some((x) => x.startsWith("FENCE-STALE-SHA"))).toBe(true);
  rmSync(ledger, { force: true });
});

test("two_source_verdict: the FORBIDDEN EVIDENCE SET is never consulted", async () => {
  // no fence, no review run — green battery + an open PR + a commit change NOTHING.
  const r = await verify({ jobDir: JOB, headSha: HEAD, sessionId: "jarvis-upper-2", runFence: redFence, fetchReviews: emptyReviews, ledgerPath: "/nonexistent/ledger.jsonl" });
  expect(r.verdict).toBe("UNVERIFIED");
  expect(JSON.stringify(r.sources)).not.toContain("tests pass");
  expect(APPROVING_VERDICTS).toContain("approved");
});
