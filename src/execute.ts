// executePlan: the ONLY path to ORDER merges. Plan is printed, never executed,
// without {confirm:true}. Guardrail re-evaluated EVERY step; first
// failure halts with partial state recorded (never auto-continues).
// INVERSION (Plan A-3): GitHub decides MAY; the factory decides ORDER.
// The factory NEVER merges — it orders and publishes. The human merges.
// On publish success the PR lands in "merge_ordered", never "merged".
import { Database } from "bun:sqlite";
import { orderMerges } from "./plan";
import { guardrail } from "./guardrail";

export interface MergeAdapter {
  publish(prId: string): Promise<{ ok: boolean }>;
}

export interface PlanExecution {
  planId: string;
  merged: string[];
  haltedAt: string | null;
  haltReason: string | null;
}

export async function executePlan(
  db: Database,
  adapter: MergeAdapter,
  opts: { confirm: boolean; planId?: string },
): Promise<PlanExecution> {
  if (!opts.confirm) throw new Error("UNCONFIRMED-PLAN");
  const v = orderMerges(db);
  if (v.kind !== "ok") throw new Error("CYCLE");
  const planId = opts.planId ?? `plan:${Date.now()}`;
  const exec: PlanExecution = { planId, merged: [], haltedAt: null, haltReason: null };
  for (const pr of v.order) {
    const g = guardrail(db, pr);
    if (!g.ok) {
      exec.haltedAt = pr;
      exec.haltReason = g.reasons.join(";");
      return exec;
    }
    const r = await adapter.publish(pr);
    if (!r.ok) {
      exec.haltedAt = pr;
      exec.haltReason = "PUBLISH-CALL-FAILED";
      return exec;
    }
    db.query("UPDATE pr_node SET state='merge_ordered', merged_at=strftime('%s','now') WHERE id = ?").run(pr);
    exec.merged.push(pr);
  }
  return exec;
}
