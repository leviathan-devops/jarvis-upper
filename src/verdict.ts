// verdict.ts — THE TWO-SOURCE VERDICT LAW (operator law 2026-09-21).
//
// A job is VERIFIED **iff** BOTH sources are green ON THE SAME HEAD SHA:
//   SOURCE 1 (fence)  : `fence2 adjudicate <job> --expect-spec-sha <sha>` exits 0
//   SOURCE 2 (review) : an AO review run approves THAT SAME head sha
// ONE source alone is UNVERIFIED. A stale sha on either is UNVERIFIED.
// The FORBIDDEN EVIDENCE SET (commit-exists · diff-changed · drift-gate-green ·
// worker-tests-pass · PR-open · transcript-shows-spawn · "I read it") is never a source.
import { readFileSync, existsSync } from "node:fs";
import { resolve as resolvePath, relative as relativePath, isAbsolute, normalize } from "node:path";

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
// FIXED 2026-09-23 (muse round-4 HIGH): the mirror of APPROVING. A run whose
// verdict is here BLOCKS the head — an approval must never outvote a rejection
// on the SAME sha.
export const REJECTING_VERDICTS = ["changes_requested", "changes-requested", "requested_changes",
  "rejected", "reject", "changes_requested_by_reviewer", "blocked", "block", "fail", "failed", "denied"] as const;
export const FENCE_DEFAULT = process.env.FENCE2_BIN || "/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py";
// FIXED (ao-review-4 finding): FENCE_LEDGER is now the ONE env var (FENCE2_LEDGER
// kept as a back-compat alias) so fence-check.py, .githooks/pre-commit and this
// module all resolve the SAME ledger.
export const LEDGER_DEFAULT = process.env.FENCE_LEDGER || process.env.FENCE2_LEDGER || "/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl";

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
    // FIXED (ocr audit high): the row was matched on `parsed.job === needle`
    // FIRST but fell back to a raw SUBSTRING `lines[i].includes(needle)` when the
    // row carried no string `job` — so a malformed row (or a needle like "fence")
    // could match on its `evidence`/`seat` text and attribute ANOTHER job's PASS to
    // this head. The match is now EXACT on the `job` field only; a row without a
    // string `job` is not a row for this job.
    let parsed: { job?: string; verdict?: string; evidence?: string } | null = null;
    try { parsed = JSON.parse(lines[i]); } catch { continue; }
    if (!parsed || typeof parsed.job !== 'string' || parsed.job !== jobNeedle) continue;
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
    // REFUTED (ocr round-4 CRITICAL claim: "stdout is a Uint8Array, so
    // toString() gives comma-joined bytes"). MEASURED: Bun.spawnSync().stdout
    // is a Buffer (Buffer.isBuffer === true) whose toString() decodes UTF-8 —
    // it returns "/home/leviathan", not "104,101,...". Pinned by the decoded
    // assertions in tests/spec_audit.test.ts (which pass).
    return { code: p.exitCode ?? -1, out: (p.stdout?.toString() ?? "").trim() };
  };
  const top = run(["git", "-C", jobDir, "rev-parse", "--show-toplevel"]);
  if (top.code !== 0 || !top.out) return { ok: false, reason: "FENCE-NOT-IN-A-WORKTREE" };
  const head = run(["git", "-C", top.out, "rev-parse", "HEAD"]);
  if (head.code !== 0) return { ok: false, reason: "FENCE-HEAD-UNREADABLE", worktree: top.out };
  if (!head.out.toLowerCase().startsWith(headSha.toLowerCase().slice(0, 40)) && head.out !== headSha) {
    return { ok: false, reason: `FENCE-HEAD-MISMATCH: worktree ${head.out.slice(0, 12)} != claimed ${headSha.slice(0, 12)}`, worktree: top.out, actual: head.out };
  }
  // THE ARTIFACT BINDING — FAIL-CLOSED (ocr audit CRITICAL, 2026-09-24).
  // The old shape was a broad try whose handler only carried a comment
  // ("the HEAD + clean checks hold"), and whose inner
  // `if (artifactAbs && insideWorktree(...))` skipped EVERY failure:
  // a missing SPEC.md, no `artifact:` line, an artifact outside the worktree, or —
  // the core defect — a `git show HEAD:<rel>` that FAILED (the artifact is NOT
  // committed at the claimed head) all fell through to FENCE-GREEN. An uncommitted
  // artifact therefore proved nothing about the head and still read green.
  // Now: the SPEC must be readable, must NAME an artifact, the artifact must resolve
  // INSIDE the worktree, and it MUST exist at HEAD with byte-identical content.
  const specDir = jobDir;
  let spec: string;
  try {
    spec = readFileSync(`${specDir}/SPEC.md`, "utf8");
  } catch {
    return { ok: false, reason: "FENCE-NO-SPEC: SPEC.md is unreadable in the job dir", worktree: top.out };
  }
  {
    const m = spec.match(/artifact:\s*(\S+)/);
    if (!m) {
      return { ok: false, reason: "FENCE-NO-ARTIFACT: SPEC.md names no artifact to bind", worktree: top.out };
    }
    const artifactAbs = m[1].startsWith("/") ? m[1] : resolvePath(top.out, m[1]);
    const rel = relativePath(resolvePath(top.out), resolvePath(artifactAbs));
    const contained = rel !== "" && rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel);
    if (!contained) {
      return { ok: false, reason: "FENCE-ARTIFACT-OUTSIDE: the artifact resolves outside the worktree", worktree: top.out };
    }
    const committed = run(["git", "-C", top.out, "show", `HEAD:${rel}`]);
    if (committed.code !== 0 || committed.out.length === 0) {
      return { ok: false, reason: `FENCE-ARTIFACT-UNCOMMITTED: ${rel} is not present at HEAD`, worktree: top.out };
    }
    let onDisk: string;
    try {
      onDisk = readFileSync(artifactAbs, "utf8");
    } catch {
      return { ok: false, reason: `FENCE-ARTIFACT-MISSING: ${rel} is unreadable on disk`, worktree: top.out };
    }
    // BYTE-IDENTICAL (trailing whitespace tolerated), the documented contract.
    if (onDisk.trimEnd() !== committed.out.trimEnd()) {
      return { ok: false, reason: "FENCE-ARTIFACT-DRIFT: the job artifact != the head's committed copy", worktree: top.out };
    }
  }
  const dirty = run(["git", "-C", top.out, "status", "--porcelain"]);
  if (dirty.out.length > 0) return { ok: false, reason: `FENCE-DIRTY-WORKTREE: ${dirty.out.split("\n").length} uncommitted path(s)`, worktree: top.out };
  return { ok: true, reason: "FENCE-GREEN", worktree: top.out, actual: head.out };
}

export async function verify(opts: VerifyOpts): Promise<VerifyResult> {
  // FIXED (ship-gate LOW): an EMPTY jobDir made the SPEC path "/SPEC.md" (the filesystem
  // root). Refuse immediately instead of reading an unrelated file.
  // FIXED (ship-gate LOW): only a FALSY jobDir was rejected — "/" still built "/SPEC.md"
  // (the filesystem root) and a whitespace-only value passed then failed the read.
  // FIXED (ship gate LOW): "//" and "/./" are POSIX-equivalent to "/" and still built
  // "/SPEC.md". Normalize (collapse duplicate slashes, drop a trailing slash) first.
  // FIXED (the W14 ship gate MEDIUM): collapsing slashes left "/." / "/.." intact — still
  // the filesystem root. Strip dot-segments too, then reject any root-equivalent.
  // (PRESERVE the leading slash — a join without it made every path RELATIVE.)
  // FIXED (the W15 ship gate HIGH): the hand-rolled normalization prefixed "/" (breaking a
  // RELATIVE jobDir into "/e2e-job") and dropped `..` WITHOUT popping the previous segment
  // ("/a/b/../c" -> "/a/b/c"). `path.normalize` does POSIX resolution correctly and
  // preserves relativity. The normalized value is used EVERYWHERE below (the fence calls,
  // the SPEC read, the bind) so no caller sees a different directory than the guard approved.
  // FIXED (the W15 ship gate LOW): normalize('   ') === '   ' (not ''), so a whitespace-only
  // jobDir slipped the guard. Trim first.
  const normJobDir = opts.jobDir ? normalize(opts.jobDir.trim()) : "";
  if (!opts.jobDir || normJobDir === "" || normJobDir === "." || normJobDir === "/") {
    return { verdict: "UNVERIFIED", sources: { fence: { ran: false, exitCode: null, sha: opts.headSha, ledgerVerdict: null, reason: "NO-JOB-DIR" }, review: { ran: false, verdict: null, targetSha: null, harness: null, reason: "NO-JOB-DIR" } }, reasons: ["NO-JOB-DIR"] };
  }
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
    const inv = await runFence([fenceBin, "invariant-sha", normJobDir]);
    // FIXED (ocr audit high): the exit code was never checked and any stdout line
    // was accepted, so a FAILED invariant-sha fed garbage into --expect-spec-sha.
    // The exit code + the 16-hex format are now both required.
    if (inv.code !== 0) throw new Error(`FENCE-INVARIANT-FAILED: exit ${inv.code}`);
    // FIXED (red-team slop audit SLOP-03): this line was a DEAD duplicate parse
    // (written to invSha16, never read) directly above the identical expression.
    const invariant = inv.stdout.trim().split("\n").filter((l) => l.trim().length > 0).pop() ?? "";
    if (!/^[0-9a-f]{16}$/.test(invariant)) throw new Error(`FENCE-NO-INVARIANT-SHA: ${invariant.slice(0, 40)}`);
    const argv = [fenceBin, "adjudicate", normJobDir, "--expect-spec-sha", invariant];
    const r = await runFence(argv);
    fence.ran = true;
    fence.exitCode = r.code;
  } catch (e) {
    fence.reason = `FENCE-NOT-RUN: ${String(e).slice(0, 120)}`;
    reasons.push(fence.reason);
  }
  // The jobDir segment is passed through as-is (possibly undefined) and
  // ledgerRowFor returns null for it — the null is handled below, not masked.
  // FIXED (ocr audit high, MEASURED): the needle was the jobDir's BASENAME — for a
  // session worktree that is the SEAT ("jarvis-upper-4"), while fence2.py writes the
  // row's `job` as the SPEC's job name ("fence"). The lookup therefore NEVER matched,
  // the row read null, and (before the null-refusal fix above) a missing row silently
  // read FENCE-GREEN. The needle is now the SPEC's `job:` value, falling back to the
  // basename when no SPEC is readable.
  const specRead = ((): { job: string } | { failure: string } => {
    try {
      // FIXED (ship gate LOW): the guard normalized the path but the READ used the RAW
      // jobDir, so "/./SPEC.md" etc. still probed. Use the normalized value.
      const sp = readFileSync(`${normJobDir}/SPEC.md`, "utf8");
      const m = sp.match(/^\s*job:\s*(\S+)\s*$/m);
      return m ? { job: m[1] } : { failure: "SPEC-NO-JOB" };
    } catch (e) { return { failure: `SPEC-UNREADABLE:${String(e).slice(0, 60)}` }; }
  })();
  // FIXED (red-team audit R13): the SPEC-read failure was ERASED — the code fell
  // silently back to the jobDir basename, which for a session worktree is the SEAT
  // ("jarvis-upper-4"), not the SPEC's job name. The failure is surfaced in the
  // REFUSAL below (when the needle yields no row), never in a green case.
  // FIXED (ship-gate LOW): when the SPEC is unreadable, do NOT populate ledgerVerdict from a
  // GUESSED needle (it is misleading for post-mortem) — the refusal below carries the cause.
  // FIXED (ship-gate LOW): the basename RHS was DEAD — `specRead` is `{job}` XOR `{failure}`,
  // so the `??` never evaluated. The discriminated union makes the needle unconditional.
  // FIXED (the W15 ship gate MEDIUM): ledgerRowFor can THROW (a TOCTOU delete, EACCES,
  // a corrupt file) outside any try/catch -> verify() rejected instead of returning
  // UNVERIFIED. Map a throw to a fail-closed refusal.
  let row: { verdict?: string } | null = null;
  if (!("failure" in specRead)) {
    try { row = ledgerRowFor(ledgerPath, specRead.job) as { verdict?: string } | null; }
    catch (e) { reasons.push(`FENCE-LEDGER-READ:${String(e).slice(0, 80)}`); }
  }
  fence.ledgerVerdict = row?.verdict ?? null;
  // ADJUDICATED (ocr audit high, two-sided — REJECTED): the finding claimed "the
  // ledger invariant SHA is never bound". MEASURED: the ledger row's 16-hex
  // `evidence` prefix is the ARTIFACT's sha16 (stamped by `fence2.py init` into the
  // SPEC's sha-map), NOT the SPEC invariant — two DIFFERENT objects by design (the
  // real row: evidence "1ea6c0f4bb73ea95|sandbox=bwrap|spec_bound:true", where
  // 1ea6c0f4bb73ea95 is the artifact hash). The spec binding IS enforced: the
  // adjudicate call passes --expect-spec-sha <invariant> (a mismatch refuses
  // SPEC_FORGED, exit 1), and the row's spec_bound flag records it. Comparing the
  // artifact sha16 to the invariant would flag EVERY green row (a false positive).
  if (fence.ran) {
    if (fence.exitCode !== 0) fence.reason = `FENCE-FAILED: exit ${fence.exitCode}`;
    // FIXED (ocr audit high): the old guard was `ledgerVerdict && ledgerVerdict !== "PASS"`,
    // so a MISSING ledger / no matching row / an undefined needle left ledgerVerdict
    // null and FELL THROUGH to bind() -> FENCE-GREEN. The two-source law requires a
    // PASS ROW: a null verdict is now a refusal, not a pass.
    // FIXED (ship-gate HIGH): an UNREADABLE SPEC means the needle was a GUESS (the jobDir
    // basename = the SEAT name). A guessed needle that happens to match SOME row would read
    // green off the wrong job's row — so the failure is a REFUSAL, not a note. (In a real
    // green run the fence READ the SPEC to adjudicate, so a failure here is a TOCTOU/stub.)
    else if ("failure" in specRead) fence.reason = `FENCE-LEDGER-NEEDLE:${specRead.failure}`;
    else if (fence.ledgerVerdict !== "PASS") fence.reason = `FENCE-LEDGER:${fence.ledgerVerdict ?? "NO-ROW"}`;
    // The ledger's sha16 is the SPEC's INVARIANT HASH, not a git sha — they are
    // different objects. The honest binding is: the adjudicated JOB DIR must be a
    // git worktree whose HEAD IS the claimed head, with the artifact committed clean.
    else {
      // FIXED (the W15 ship gate MEDIUM): a THROWING bind (a missing git, a bad jobDir)
      // escaped verify() as a rejection. Map it to a fail-closed refusal.
      let b: { ok: boolean; reason: string };
      try { b = bind(normJobDir, opts.headSha); }
      catch (e) { b = { ok: false, reason: `FENCE-BIND-THREW:${String(e).slice(0, 80)}` }; }
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
    if (runs.length === 0) review.reason = "REVIEW-NO-RUNS";
    else {
      // FIXED 2026-09-23 (muse round-4 HIGH): `runs.find(approving)` returned the
      // FIRST approval and IGNORED a later rejection on the SAME head sha, so
      // [approved@H, changes_requested@H] read REVIEW-GREEN and the verdict
      // posted success for a REJECTED head — a fail-open. A rejection on the head
      // sha now wins over any approval (the fail-closed polarity).
      // FIXED (ocr audit high): only `r.verdict` was read, but the merged type (and
      // the AO daemon's payloads) also carry `status: "approved"|"completed"` — a run
      // reporting approval via `status` alone read REVIEW-NOT-APPROVED. Both fields
      // are now honoured (fail-closed either way).
      const verdictOf = (r: { verdict?: string | null; status?: string | null }) =>
        String(r.verdict ?? r.status ?? "").toLowerCase();
      const isReject = (r: { verdict?: string | null; status?: string | null }) => (REJECTING_VERDICTS as readonly string[]).includes(verdictOf(r));
      const isApprove = (r: { verdict?: string | null; status?: string | null }) => (APPROVING_VERDICTS as readonly string[]).includes(verdictOf(r));
      // FIXED 2026-09-23 (qwen-code-audit re-run REAL): the previous fix checked
      // EVERY run, so a rejection on a DIFFERENT sha blocked THIS head — over-
      // blocking. The per-sha law: only a run BOUND to this head can decide it.
      // FIXED (ao-review-4 round 2 finding): the OLD binds() returned true when
      // targetSha was MISSING ("presume current") — so an UNBOUND approval read
      // GREEN on any head. The binding is now EXPLICIT: a run must NAME this head.
      const binds = (r: { targetSha?: string | null }) => r.targetSha === opts.headSha;
      const rejecting = runs.find((r) => binds(r) && isReject(r));
      const approving = runs.find((r) => binds(r) && isApprove(r)) as
        | { verdict?: string | null; status?: string | null; targetSha?: string | null }
        | undefined;
      // an approval on a DIFFERENT sha is STALE — named, never silently ignored
      const staleApproval = runs.find((r) => !binds(r) && isApprove(r));
      if (rejecting) review.reason = `REVIEW-REJECTED: ${verdictOf(rejecting)}`;
      else if (approving) {
        // FIXED (ocr audit high): `String(approving.verdict)` stored the literal
        // "undefined" when the run carried `status: "approved"` and no `verdict`.
        // The recorded value is the field that actually decided the approval.
        review.verdict = String(approving.verdict ?? approving.status ?? "");
        review.targetSha = approving.targetSha ?? null;
        review.reason = "REVIEW-GREEN";
      }
      else if (staleApproval) review.reason = `REVIEW-STALE-SHA: ${String(staleApproval.targetSha).slice(0, 7)} != head ${opts.headSha.slice(0, 7)}`;
      else review.reason = `REVIEW-NOT-APPROVED: verdicts ${JSON.stringify(runs.map((r) => r.verdict ?? null))}`;
    }
  } catch (e) {
    review.reason = `REVIEW-NOT-RUN: ${String(e).slice(0, 120)}`;
  }
  if (review.reason !== "REVIEW-GREEN") reasons.push(review.reason);

  const verdict = fence.reason === "FENCE-GREEN" && review.reason === "REVIEW-GREEN" ? "VERIFIED" : "UNVERIFIED";
  return { verdict, sources: { fence, review }, reasons };
}
