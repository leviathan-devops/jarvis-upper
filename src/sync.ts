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

export function upsertPr(db: Database, r: PrRow): void {
  const EX = "excluded";  // the ON CONFLICT alias, via a template (an inline literal kept being mangled)
  db.query(`INSERT INTO pr_node(id, project, pr_number, session_id, head_sha,
            base_sha, source_branch, target_branch, state, worker_hint, minted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
            -- FIXED (ocr audit high, MEASURED): this line clobbered an ADVANCED state
            -- (ready_to_merge/merge_ordered/merged) back to the API-reported "open" on
            -- every poll — the publisher then never saw an eligible PR. An advanced
            -- state is STICKY: the sync only advances an "open" row.
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
      r.source_branch ?? null, r.target_branch ?? null, r.state,
      r.worker_hint ?? null);
}

export async function syncPrs(db: Database, list: () => Promise<PrRow[]>): Promise<{ rows: number }> {
  const rows = await list();
  const tx = db.transaction(() => { for (const r of rows) upsertPr(db, r); });
  tx();
  return { rows: rows.length };
}
