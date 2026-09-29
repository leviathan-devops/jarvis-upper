// merge-record: THE TERMINAL-EVENT RECORDER.
//
// The factory's design is INVERTED on purpose (see src/execute.ts): "GitHub decides
// MAY; the factory decides ORDER. The factory NEVER merges — it orders and
// publishes. The human merges." A PR therefore lands in `merge_ordered`, never in
// `merged` — and until now NOTHING recorded the merge itself, so the DONE
// condition's second half ("the merge commit's sha is in the ledger") had no code
// path. This module is that path: the factory OBSERVES the merge (it does not
// perform it) and records the merge commit's sha into the same append-only ledger
// the fence writes.
import { appendFileSync, existsSync, mkdirSync, readFileSync, openSync, closeSync, unlinkSync, statSync } from "node:fs";
import { dirname } from "node:path";

export interface PrMergeState {
  merged: boolean;
  mergeCommitSha: string | null;
  /** the PR's state as GitHub reports it: open | closed, or a named failure. */
  state: string;
}

/** Read the authoritative merge state of a PR (GET /repos/{o}/{r}/pulls/{n}). */
export async function fetchPrMerge(opts: {
  owner: string;
  repo: string;
  prNumber: number;
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<PrMergeState> {
  // A missing target is a LOUD named refusal, never a request to .../undefined.
  // FIXED (ocr audit high): `!opts` threw before the guard, and `!prNumber` let
  // NaN/negative/float through into the URL. Both are validated explicitly.
  if (!opts || !opts.owner || !opts.repo || !opts.token
      || !Number.isInteger(opts.prNumber) || opts.prNumber <= 0) {
    return { merged: false, mergeCommitSha: null, state: "NO-TARGET" };
  }
  const f = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl || "https://api.github.com";
  const url = `${base}/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.repo)}/pulls/${opts.prNumber}`;
  try {
    const res = await f(url, {
      headers: { Authorization: `Bearer ${opts.token}`, Accept: "application/vnd.github+json" },
    });
    // A malformed/absent response is an unreachable state, never a throw.
    if (!res || typeof res.ok !== "boolean") return { merged: false, mergeCommitSha: null, state: "BAD-RESPONSE" };
    if (!res.ok) return { merged: false, mergeCommitSha: null, state: `HTTP-${res.status}` };
    const j = (await res.json()) as { merged?: boolean; merge_commit_sha?: string | null; state?: string };
    return {
      merged: Boolean(j.merged),
      mergeCommitSha: j.merge_commit_sha ?? null,
      state: j.state ?? "unknown",
    };
  } catch (e) {
    return { merged: false, mergeCommitSha: null, state: `ERROR:${String(e).slice(0, 60)}` };
  }
}

/**
 * Append the TERMINAL EVENT row to the ledger. Append-only, the same jsonl the
 * fence writes. `job:"merge"` keeps it distinct from a fence job (fence-check.py
 * matches on the job name), and the evidence prefix is the MERGE COMMIT's sha —
 * the artifact of the merge, the thing the DONE condition asks for.
 */
export function recordMerge(
  ledgerPath: string,
  row: { prId: string; prNumber: number; mergeSha: string; headSha: string; session: string },
): boolean {
  // FIXED (ocr audit high): an empty/malformed sha was appended as a MERGED
  // terminal row (evidence "|pr=..." still satisfied a naive DONE check), and
  // headSha.slice assumed a non-empty string. Both are validated LOUDLY first.
  // FIXED (ocr audit medium): a case-INSENSITIVE sha (git hex is case-insensitive;
  // some tools uppercase) + a null guard on the row itself.
  if (!row || !isSha(row.mergeSha) || !isSha(row.headSha)) {
    return false;
  }
  // FIXED (the scan HIGH): check-then-append (mergeRecorded + recordMerge) was non-atomic — two
  // concurrent ticks could both observe absent and both append. An ADVISORY lockfile ('wx', the
  // atomic exclusive create) serializes the append across processes; a stale lock is bounded.
  const lock = `${ledgerPath}.lock`;
  let fd: number | null = null;
  for (let i = 0; i < 50 && fd === null; i++) {
    try { fd = openSync(lock, "wx"); }
    catch {
      // a STALE lock (a crashed holder) older than 5s is cleared; otherwise wait briefly.
      try { if (Date.now() - statSync(lock).mtimeMs > 5000) unlinkSync(lock); } catch (e) { console.error(`merge-lock-stat:${String(e).slice(0, 40)}`); }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  if (fd === null) return false;   // could not take the lock — a LOUD false (the caller names it)
  try {
    const dir = dirname(ledgerPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // re-check UNDER the lock: another process may have appended while we waited
    if (mergeRecorded(ledgerPath, row.mergeSha)) return false;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      v: 2,
      job: "merge",
      seat: row.session || "unknown",
      step: "merge",
      verdict: "MERGED",
      fence_exit: 0,
      attempt: 1,
      pr: row.prNumber,
      head: row.headSha,
      evidence: `${canonSha(row.mergeSha)}|pr=${row.prNumber}|head=${canonSha(row.headSha).slice(0, 12)}|merged:true`,
    });
    appendFileSync(ledgerPath, line + "\n", "utf8");
    return true;
  } catch {
    // A failed record is a LOUD false (the caller names it in errors[]), never a
    // silent success — the merge happened but the ledger must not pretend it did.
    return false;
  } finally {
    try { closeSync(fd); } catch (e) { console.error(`merge-lock-close-failed:${String(e).slice(0, 40)}`); }
    try { unlinkSync(lock); } catch (e) { console.error(`merge-lock-unlink-failed:${String(e).slice(0, 40)}`); }
  }
}

/** FIXED (the ship gate low): the git-hex sha rule, in ONE place — the observer's fallback and
 *  recordMerge's guard now share it, so a rule change cannot diverge them. */
export const SHA_RE = /^[0-9a-f]{7,40}$/i;
export function isSha(s: string | null | undefined): s is string { return typeof s === "string" && SHA_RE.test(s); }
/** FIXED (the whole-file scan HIGH): `isSha` accepts UPPERCASE and `recordMerge` persisted the
 *  sha verbatim, but `mergeRecorded` compared it CASE-SENSITIVELY — the same commit in two cases
 *  (common when tools uppercase) appended DUPLICATE terminal rows. The sha is lowercased at the
 *  boundary, ONE canonical form persisted and compared. */
export const canonSha = (s: string): string => s.toLowerCase();

/** Has this merge sha already been recorded? (idempotence for a re-polling tick.) */
/**
 * FIXED (red-team audit S5): the old shape returned `false` on EVERY failure —
 * a missing file, an invalid sha, a per-line parse error, a whole-read throw — so
 * a CORRUPT/unreadable ledger read as "not recorded" and re-appended a DUPLICATE
 * terminal row. The outcomes are now distinct: true = recorded, false = genuinely
 * absent, THROW = unreadable (the caller must NOT append).
 */
export function mergeRecorded(ledgerPath: string, mergeSha: string): boolean {
  try {
    if (!existsSync(ledgerPath)) return false; // genuinely absent = not recorded
    // FIXED (ocr audit high): the inline `require("node:fs")` inside an ESM module
    // throws `ReferenceError: require is not defined` under Node/bundlers (Bun
    // tolerates it, which is why the tests passed) — readFileSync is now imported
    // at the top. The substring match was also unsound: `includes(mergeSha)` is
    // TRUE for an empty mergeSha (every string contains ""), so a blank sha
    // deduped every merge. The match is now an EXACT field test on a validated sha.
    if (!isSha(mergeSha)) return false;
    mergeSha = canonSha(mergeSha);   // FIXED (scan HIGH): the same canonical form as the write
    // FIXED (the W24 ship gate MEDIUM — a REGRESSION from W11): the eager throw inside
    // `.some()` aborted the scan on the FIRST corrupt line, so a historic bad line made
    // mergeRecorded THROW even when the requested sha WAS recorded LATER. Scan ALL lines;
    // only if NO line matched AND a corrupt one was seen is it an error.
    let corrupt = "";
    const found = readFileSync(ledgerPath, "utf8").split("\n").some((l) => {
      if (!l.includes('"job":"merge"')) return false;
      try {
        const row = JSON.parse(l) as { evidence?: string };
        return (row.evidence ?? "").split("|")[0] === mergeSha;
      } catch (e) { corrupt = String(e).slice(0, 60); return false; }
    });
    if (found) return true;
    if (corrupt) throw new Error(`LEDGER-CORRUPT-LINE:${corrupt}`);   // a claimed line that is garbage
    return false;
  } catch (e) {
    // FIXED (ship gate MEDIUM): the inner LEDGER-CORRUPT-LINE was re-wrapped into
    // LEDGER-UNREADABLE, losing the distinct corrupt-line signal. An ALREADY-NAMED
    // error propagates unwrapped.
    // FIXED (ship gate LOW): a substring match could catch a WRAPPED message. Check the
    // Error's own message.
    if (e instanceof Error && e.message.startsWith("LEDGER-CORRUPT-LINE")) throw e;
    // an unreadable ledger is an ERROR, never a false "absent"
    throw new Error(`LEDGER-UNREADABLE:${String(e).slice(0, 80)}`);
  }
}
