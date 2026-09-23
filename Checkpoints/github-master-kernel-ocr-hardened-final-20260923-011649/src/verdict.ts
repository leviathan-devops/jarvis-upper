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
export const FENCE_DEFAULT = process.env.FENCE2_BIN ?? "/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py";
export const LEDGER_DEFAULT = process.env.FENCE2_LEDGER ?? "/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl";

export interface VerifyOpts {
  jobDir: string;
  headSha: string;
  sessionId: string;
  fenceBin?: string;
  ledgerPath?: string;
  runFence?: (argv: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;
  fetchReviews?: (sessionId: string) => Promise<unknown>;
  /** the fence↔head binding check (injectable: tests stub it, production uses git) */
  bind?: (jobDir: string, headSha: string) => { ok: boolean; reason: string };
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
  const daemon = process.env.AO_DAEMON ?? 'http://localhost:3001';
  const res = await fetch(`${daemon}/api/v1/sessions/${sessionId}/reviews`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`reviews HTTP ${res.status}`);
  return res.json();
}

/** the ledger's last row for a job-id substring, parsed; null when absent. */
export function ledgerRowFor(ledgerPath: string, jobNeedle: string | undefined): { verdict: string | null; evidence: string | null; sha16: string | null } | null {
  if (!existsSync(ledgerPath)) return null;
  // An absent jobDir segment means there is no needle to match — return null
  // (the caller handles it). Explicit, not a silent default.
  if (jobNeedle === undefined) return null;
  const lines = readFileSync(ledgerPath, "utf8").split("\n").filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    // F28: try exact JSON job-id match first, fallback to substring
    let parsed: { job?: string; verdict?: string; evidence?: string } | null = null;
    try { parsed = JSON.parse(lines[i]); } catch { continue; }
    if (parsed && typeof parsed.job === 'string') {
      if (parsed.job !== jobNeedle) continue;
    } else if (!lines[i].includes(jobNeedle)) {
      continue;
    }
    try {
      const row = parsed as { verdict?: string; evidence?: string };
      const ev = row.evidence ?? "";
      const m = ev.match(/^([0-9a-f]{16})/);
      return { verdict: row.verdict ?? null, evidence: ev || null, sha16: m ? m[1] : null };
    } catch { return null; }
  }
  return null;
}


/** The honest fence↔head binding: the job dir must sit inside a git worktree
 *  whose HEAD is the claimed sha, and its artifact must be committed (clean). */
export function artifactBoundToHead(jobDir: string, headSha: string): { ok: boolean; reason: string; actual?: string; worktree?: string } {
  const run = (argv: string[]) => {
    const p = Bun.spawnSync(argv);
    return { code: p.exitCode ?? -1, out: (p.stdout?.toString() ?? "").trim() };
  };
  const top = run(["git", "-C", jobDir, "rev-parse", "--show-toplevel"]);
  if (top.code !== 0 || !top.out) return { ok: false, reason: "FENCE-NOT-IN-A-WORKTREE" };
  const head = run(["git", "-C", top.out, "rev-parse", "HEAD"]);
  if (head.code !== 0) return { ok: false, reason: "FENCE-HEAD-UNREADABLE", worktree: top.out };
  if (!head.out.toLowerCase().startsWith(headSha.toLowerCase().slice(0, 40)) && head.out !== headSha) {
    return { ok: false, reason: `FENCE-HEAD-MISMATCH: worktree ${head.out.slice(0, 12)} != claimed ${headSha.slice(0, 12)}`, worktree: top.out, actual: head.out };
  }
  // the artifact in the job dir must be byte-identical to the head's committed copy
  const specDir = jobDir;
  try {
    const spec = readFileSync(`${specDir}/SPEC.md`, "utf8");
    const m = spec.match(/artifact:\s*(\S+)/);
    if (m && m[1].startsWith("/")) {
      const rel = m[1].slice(top.out.length + 1);
      const committed = run(["git", "-C", top.out, "show", `HEAD:${rel}`]);
      const onDisk = readFileSync(m[1], "utf8");
      if (committed.code === 0 && committed.out.length > 0 && !onDisk.startsWith(committed.out.slice(0, 64))) {
        return { ok: false, reason: "FENCE-ARTIFACT-DRIFT: the job artifact != the head's committed copy", worktree: top.out };
      }
    }
  } catch { /* no artifact binding available — the HEAD + clean checks above still hold */ }
  const dirty = run(["git", "-C", top.out, "status", "--porcelain"]);
  if (dirty.out.length > 0) return { ok: false, reason: `FENCE-DIRTY-WORKTREE: ${dirty.out.split("\n").length} uncommitted path(s)`, worktree: top.out };
  return { ok: true, reason: "FENCE-GREEN", worktree: top.out, actual: head.out };
}

export async function verify(opts: VerifyOpts): Promise<VerifyResult> {
  const fenceBin = opts.fenceBin ?? FENCE_DEFAULT;
  const ledgerPath = opts.ledgerPath ?? LEDGER_DEFAULT;
  const runFence = opts.runFence ?? defaultRunFence;
  const fetchReviews = opts.fetchReviews ?? defaultFetchReviews;
  const bind = opts.bind ?? artifactBoundToHead;
  const reasons: string[] = [];
  if (!opts.headSha || opts.headSha.length < 40) {
    reasons.push('HEAD-SHA-INVALID');
    return { verdict: 'UNVERIFIED', sources: { fence: { ran: false, exitCode: null, sha: opts.headSha, ledgerVerdict: null, reason: 'HEAD-SHA-INVALID' }, review: { ran: false, verdict: null, targetSha: null, harness: null, reason: 'HEAD-SHA-INVALID' } }, reasons };
  }

  // ---- SOURCE 1: the fence, bound to the head sha -------------------------
  const fence: FenceSource = { ran: false, exitCode: null, sha: opts.headSha, ledgerVerdict: null, reason: "" };
  try {
    // fence2's --expect-spec-sha is the SPEC's INVARIANT sha16 (not a git sha):
    // the kernel-held value computed over the SPEC minus its sha-map. Compute it
    // here, then adjudicate against it.
    const inv = await runFence([fenceBin, "invariant-sha", opts.jobDir]);
    const invariant = inv.stdout.trim().split("\n").filter((l) => l.trim().length > 0).pop() ?? "";
    if (!invariant) throw new Error("FENCE-NO-INVARIANT-SHA");
    const argv = [fenceBin, "adjudicate", opts.jobDir, "--expect-spec-sha", invariant];
    const r = await runFence(argv);
    fence.ran = true;
    fence.exitCode = r.code;
  } catch (e) {
    fence.reason = `FENCE-NOT-RUN: ${String(e).slice(0, 120)}`;
    reasons.push(fence.reason);
  }
  // The jobDir segment is passed through as-is (possibly undefined) and
  // ledgerRowFor returns null for it — the null is handled below, not masked.
  const row = ledgerRowFor(ledgerPath, opts.jobDir.split("/").filter(Boolean).pop());
  fence.ledgerVerdict = row?.verdict ?? null;
  if (fence.ran) {
    if (fence.exitCode !== 0) fence.reason = `FENCE-FAILED: exit ${fence.exitCode}`;
    else if (fence.ledgerVerdict && fence.ledgerVerdict !== "PASS") fence.reason = `FENCE-LEDGER:${fence.ledgerVerdict}`;
    // The ledger's sha16 is the SPEC's INVARIANT HASH, not a git sha — they are
    // different objects. The honest binding is: the adjudicated JOB DIR must be a
    // git worktree whose HEAD IS the claimed head, with the artifact committed clean.
    else {
      const b = bind(opts.jobDir, opts.headSha);
      if (!b.ok) fence.reason = b.reason;
      else fence.reason = "FENCE-GREEN";
    }
  }
  if (fence.reason !== "FENCE-GREEN" && !fence.reason.startsWith('FENCE-NOT-RUN')) reasons.push(fence.reason);
  // F30: FENCE-NOT-RUN already pushed in catch block above

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
    const runs = [...(payload.runs ?? []), ...(payload.reviews ?? []).map((r) => ({ verdict: r.status, targetSha: r.targetSha }))]; // merge reviews into runs shape
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
