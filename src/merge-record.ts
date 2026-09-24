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
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
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
  if (!opts.owner || !opts.repo || !opts.prNumber || !opts.token) {
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
  try {
    const dir = dirname(ledgerPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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
      evidence: `${row.mergeSha}|pr=${row.prNumber}|head=${row.headSha.slice(0, 12)}|merged:true`,
    });
    appendFileSync(ledgerPath, line + "\n", "utf8");
    return true;
  } catch {
    // A failed record is a LOUD false (the caller names it in errors[]), never a
    // silent success — the merge happened but the ledger must not pretend it did.
    return false;
  }
}

/** Has this merge sha already been recorded? (idempotence for a re-polling tick.) */
export function mergeRecorded(ledgerPath: string, mergeSha: string): boolean {
  try {
    if (!existsSync(ledgerPath)) return false;
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    return readFileSync(ledgerPath, "utf8")
      .split("\n")
      .some((l) => l.includes(`"job":"merge"`) && l.includes(mergeSha));
  } catch {
    return false;
  }
}
