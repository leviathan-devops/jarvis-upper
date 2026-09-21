// verdict.ts — THE TWO-SOURCE VERDICT LAW (operator law 2026-09-21).
//
// A job is VERIFIED **iff** BOTH sources are green ON THE SAME HEAD SHA:
//   SOURCE 1 (fence)  : `fence2 adjudicate <job> --expect-spec-sha <sha>` exits 0
//   SOURCE 2 (review) : an AO review run approves THAT SAME head sha
// ONE source alone is UNVERIFIED. A stale sha on either is UNVERIFIED.
// The FORBIDDEN EVIDENCE SET (commit-exists · diff-changed · drift-gate-green ·
// worker-tests-pass · PR-open · transcript-shows-spawn · "I read it") is never a source.
import { readFileSync, existsSync } from "node:fs";

export interface FenceSource {
  ran: boolean;
  exitCode: number | null;
  sha: string | null;
  ledgerVerdict: string | null;
  reason: string;
}
export interface ReviewSource {
  ran: boolean;
  verdict: string | null;
  targetSha: string | null;
  harness: string | null;
  reason: string;
}
export interface VerifyResult {
  verdict: "VERIFIED" | "UNVERIFIED";
  sources: { fence: FenceSource; review: ReviewSource };
  reasons: string[];
}

export const APPROVING_VERDICTS = ["approved", "approve", "lgtm", "pass", "passed"] as const;
export const FENCE_DEFAULT = "/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py";
export const LEDGER_DEFAULT = "/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl";

export interface VerifyOpts {
  jobDir: string;
  headSha: string;
  sessionId: string;
  fenceBin?: string;
  ledgerPath?: string;
  runFence?: (argv: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;
  fetchReviews?: (sessionId: string) => Promise<unknown>;
}

export function sha16(s: string): string {
  return new Bun.CryptoHasher("sha256").update(s).digest("hex").slice(0, 16);
}

async function defaultRunFence(argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const p = Bun.spawn(["python3", ...argv], { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  const code = await p.exited;
  return { code: code ?? -1, stdout: out, stderr: err };
}

async function defaultFetchReviews(sessionId: string): Promise<unknown> {
  const res = await fetch(`http://localhost:3001/api/v1/sessions/${sessionId}/reviews`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`reviews HTTP ${res.status}`);
  return res.json();
}

/** the ledger's last row for a job-id substring, parsed; null when absent. */
export function ledgerRowFor(ledgerPath: string, jobNeedle: string): { verdict: string | null; evidence: string | null; sha16: string | null } | null {
  if (!existsSync(ledgerPath)) return null;
  const lines = readFileSync(ledgerPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes(jobNeedle)) continue;
    try {
      const row = JSON.parse(lines[i]) as { verdict?: string; evidence?: string };
      const ev = row.evidence ?? "";
      const m = ev.match(/^([0-9a-f]{16})/);
      return { verdict: row.verdict ?? null, evidence: ev || null, sha16: m ? m[1] : null };
    } catch { return null; }
  }
  return null;
}

export async function verify(opts: VerifyOpts): Promise<VerifyResult> {
  const fenceBin = opts.fenceBin ?? FENCE_DEFAULT;
  const ledgerPath = opts.ledgerPath ?? LEDGER_DEFAULT;
  const runFence = opts.runFence ?? defaultRunFence;
  const fetchReviews = opts.fetchReviews ?? defaultFetchReviews;
  const reasons: string[] = [];

  // ---- SOURCE 1: the fence, bound to the head sha -------------------------
  const fence: FenceSource = { ran: false, exitCode: null, sha: opts.headSha, ledgerVerdict: null, reason: "" };
  try {
    const argv = [fenceBin, "adjudicate", opts.jobDir, "--expect-spec-sha", opts.headSha];
    const r = await runFence(argv);
    fence.ran = true;
    fence.exitCode = r.code;
  } catch (e) {
    fence.reason = `FENCE-NOT-RUN: ${String(e).slice(0, 120)}`;
    reasons.push(fence.reason);
  }
  const row = ledgerRowFor(ledgerPath, opts.jobDir.split("/").filter(Boolean).pop() ?? "");
  fence.ledgerVerdict = row?.verdict ?? null;
  if (fence.ran) {
    if (fence.exitCode !== 0) fence.reason = `FENCE-FAILED: exit ${fence.exitCode}`;
    else if (fence.ledgerVerdict && fence.ledgerVerdict !== "PASS") fence.reason = `FENCE-LEDGER:${fence.ledgerVerdict}`;
    else if (row?.sha16 && !opts.headSha.toLowerCase().startsWith(row.sha16.toLowerCase())) fence.reason = `FENCE-STALE-SHA: ledger ${row.sha16} != head ${opts.headSha.slice(0, 16)}`;
    else fence.reason = "FENCE-GREEN";
  }
  if (fence.reason !== "FENCE-GREEN") reasons.push(fence.reason);

  // ---- SOURCE 2: the review, bound to the SAME head sha -------------------
  const review: ReviewSource = { ran: false, verdict: null, targetSha: null, harness: null, reason: "" };
  try {
    const payload = (await fetchReviews(opts.sessionId)) as {
      reviewerHarness?: string;
      reviews?: { status?: string; targetSha?: string }[];
      runs?: { status?: string; verdict?: string; targetSha?: string }[];
    };
    review.ran = true;
    review.harness = payload.reviewerHarness ?? null;
    const runs = payload.runs ?? [];
    const approving = runs.find((r) => r.verdict != null && (APPROVING_VERDICTS as readonly string[]).includes(String(r.verdict).toLowerCase()));
    if (runs.length === 0) review.reason = "REVIEW-NO-RUNS";
    else if (!approving) review.reason = `REVIEW-NOT-APPROVED: verdicts ${JSON.stringify(runs.map((r) => r.verdict ?? null))}`;
    else {
      review.verdict = String(approving.verdict);
      review.targetSha = approving.targetSha ?? null;
      if (review.targetSha !== opts.headSha) review.reason = `REVIEW-STALE-SHA: ${String(review.targetSha).slice(0, 7)} != head ${opts.headSha.slice(0, 7)}`;
      else review.reason = "REVIEW-GREEN";
    }
  } catch (e) {
    review.reason = `REVIEW-NOT-RUN: ${String(e).slice(0, 120)}`;
  }
  if (review.reason !== "REVIEW-GREEN") reasons.push(review.reason);

  const verdict = fence.reason === "FENCE-GREEN" && review.reason === "REVIEW-GREEN" ? "VERIFIED" : "UNVERIFIED";
  return { verdict, sources: { fence, review }, reasons };
}
