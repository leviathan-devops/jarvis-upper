// Guardrail: merge eligibility = gates green + sha-bound + deps merged.
// Blocking is the safe default; every block carries its reason rows.
import { Database } from "bun:sqlite";
import { GATE_TO_CONTEXT } from "./status-contract";

export interface Eligibility {
  ok: boolean;
  reasons: string[];
}

const REQUIRED_GATES = Object.keys(GATE_TO_CONTEXT) as (keyof typeof GATE_TO_CONTEXT)[];

export function guardrail(db: Database, prId: string): Eligibility {
  const reasons: string[] = [];
  const pr = db.query("SELECT id, state, head_sha FROM pr_node WHERE id = ?").get(prId) as
    | { id: string; state: string; head_sha: string | null }
    | null;
  if (!pr) return { ok: false, reasons: ["PR-MISSING"] };
  if (pr.state !== "ready_to_merge") reasons.push(`NOT-READY:${pr.state}`);
  for (const g of REQUIRED_GATES) {
    const row = db.query("SELECT verdict, sha16 FROM gate_pass WHERE pr_node = ? AND gate = ?")
      .get(prId, g) as { verdict: string; sha16: string | null } | null;
    if (!row || row.verdict !== "pass") { reasons.push(`GATE-MISSING:${g}`); continue; }
    if (pr.head_sha !== null && row.sha16 !== null && row.sha16 !== pr.head_sha) {
      reasons.push(`STALE-GATE:${g}`);
    }
  }
  const deps = db
    .query("SELECT from_pr AS f FROM pr_edge WHERE to_pr = ? AND kind = 'depends_on'")
    .all(prId) as { f: string }[];
  for (const d of deps) {
    const st = db.query("SELECT state FROM pr_node WHERE id = ?").get(d.f) as
      | { state: string } | null;
    if (!st || st.state !== "merged") reasons.push(`DEP-UNMERGED:${d.f}`);
  }
  return { ok: reasons.length === 0, reasons };
}
