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
  db.query(`INSERT INTO pr_node(id, project, pr_number, session_id, head_sha,
            base_sha, source_branch, target_branch, state, worker_hint, minted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
            ON CONFLICT(id) DO UPDATE SET state=excluded.state,
            head_sha=excluded.head_sha, worker_hint=excluded.worker_hint`)
    .run(`pr:${r.session_id}:${r.pr_number}`, r.project, r.pr_number,
      r.session_id, r.head_sha, r.base_sha ?? null,
      r.source_branch ?? null, r.target_branch ?? null, r.state,
      r.worker_hint ?? null);
}

export async function syncPrs(db: Database, list: () => Promise<PrRow[]>): Promise<{ rows: number }> {
  const rows = await list();
  for (const r of rows) upsertPr(db, r);
  const count = db.query("SELECT COUNT(*) AS n FROM pr_node").get() as { n: number };
  return { rows: count.n };
}
