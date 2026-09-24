// syncProject: facts pull (API-shaped) into pr_node. Stub-injectable for
// tests; production passes adapter list fns (never the daemon database direct).
import { Database } from "bun:sqlite";

export interface PrRow {
  project: string;
  pr_number: number;
  session_id: string;
  head_sha: string | null;
  base_sha?: string | null;
  source_branch?: string | null;
  target_branch?: string | null;
  state: string;
  worker_hint?: string | null;
}

/** The states the store's CHECK admits (src/store.ts:16). A row outside this set
 *  would throw inside the transaction and roll back EVERY row — so it is refused
 *  per-row instead. */
export const ALLOWED_STATES = ["open", "ready_to_merge", "merge_ordered", "merged", "rejected", "kicked"] as const;

/** Validate one AO row BEFORE the insert. Returns a named reason or null. */
export function validatePrRow(r: PrRow): string | null {
  if (!r || typeof r !== "object") return "NOT-A-ROW";
  if (!r.session_id || typeof r.session_id !== "string") return "NO-SESSION-ID";
  if (!Number.isInteger(r.pr_number) || r.pr_number <= 0) return "BAD-PR-NUMBER";
  if (!ALLOWED_STATES.includes(r.state as typeof ALLOWED_STATES[number])) return `BAD-STATE:${r.state}`;
  return null;
}

export function upsertPr(db: Database, r: PrRow): void {
  // the terminal state is not writable from a sync payload (see the CASE below)
  const state = r.state === "merged" ? "merge_ordered" : r.state;
  const EX = "excluded";  // the ON CONFLICT alias, via a template (an inline literal kept being mangled)
  db.query(`INSERT INTO pr_node(id, project, pr_number, session_id, head_sha,
            base_sha, source_branch, target_branch, state, worker_hint, minted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
            -- FIXED (ocr audit high, MEASURED): this line clobbered an ADVANCED state
            -- (ready_to_merge/merge_ordered/merged) back to the API-reported "open" on
            -- every poll — the publisher then never saw an eligible PR. An advanced
            -- state is STICKY: the sync only advances an "open" row.
            -- FIXED (red-team audit S3): sync must NEVER write the terminal state — that is the
            -- TERMINAL EVENT, whose proof is the ledger row written by
            -- fetchPrMerge+recordMerge. An AO payload reporting it (a retry, a
            -- race with the human merge, a vocabulary change) would otherwise land
            -- pr_node=merged with NO terminal row: the DONE check ("merge sha in the
            -- ledger") then fails forever on a row that LOOKS done.
            ON CONFLICT(id) DO UPDATE SET state=CASE
              WHEN pr_node.state IN ('ready_to_merge','merge_ordered','merged','rejected','kicked') THEN pr_node.state
              ELSE excluded.state END,
            -- FIXED (ocr audit high): the state was frozen while head_sha kept
            -- advancing — an APPROVED row could then point at a new, unvalidated
            -- SHA (a review/verdict mismatch). The sha is frozen with the state.
            head_sha=CASE
              WHEN pr_node.state IN ('ready_to_merge','merge_ordered','merged','rejected','kicked') THEN pr_node.head_sha
              ELSE COALESCE(excluded.head_sha, pr_node.head_sha) END,
            worker_hint=COALESCE(excluded.worker_hint, pr_node.worker_hint),
            base_sha=COALESCE(excluded.base_sha, pr_node.base_sha),
            source_branch = COALESCE(${EX}.source_branch, pr_node.source_branch),
            target_branch = COALESCE(${EX}.target_branch, pr_node.target_branch)`)
    .run(`pr:${r.session_id}:${r.pr_number}`, r.project, r.pr_number,
      r.session_id, r.head_sha, r.base_sha ?? null,
      r.source_branch ?? null, r.target_branch ?? null, state,
      r.worker_hint ?? null);
}

export async function syncPrs(db: Database, list: () => Promise<PrRow[]>): Promise<{ rows: number; skipped: string[] }> {
  const rows = await list();
  if (!Array.isArray(rows)) return { rows: 0, skipped: ["LIST-NOT-AN-ARRAY"] };
  // FIXED (red-team audit F-20): the old shape wrapped ALL rows in ONE transaction,
  // so a single out-of-vocabulary state threw and rolled back the ENTIRE batch —
  // every tick, for as long as the bad row persisted (a silent total sync outage).
  // Now each row is VALIDATED first and the bad ones are SKIPPED BY NAME; the
  // good rows commit. The caller receives the skip list.
  const skipped: string[] = [];
  const good: PrRow[] = [];
  for (const r of rows) {
    const bad = validatePrRow(r);
    if (bad) { skipped.push(`${r?.session_id ?? "?"}:${r?.pr_number ?? "?"}:${bad}`); continue; }
    good.push(r);
  }
  if (good.length > 0) {
    const tx = db.transaction(() => { for (const r of good) upsertPr(db, r); });
    tx();
  }
  return { rows: good.length, skipped };
}
