// orderMerges: topological planner over pr_edge(depends_on).
// Pure function of rows: NEVER executes merges (executePlan is separate,
// confirm-gated). Cycle -> CYCLE refusal (exit-2 class), zero partial output.
import { Database } from "bun:sqlite";

export type PlanVerdict = { kind: "ok"; order: string[] } | { kind: "cycle"; nodes: string[] };

export function orderMerges(db: Database, onlyState: string = "ready_to_merge"): PlanVerdict {
  const nodes = db
    .query("SELECT id FROM pr_node WHERE state = ? ORDER BY id")
    .all(onlyState) as { id: string }[];
  const ids = nodes.map((n) => n.id);
  const edges = db
    .query("SELECT from_pr AS f, to_pr AS t FROM pr_edge WHERE kind = 'depends_on'")
    .all() as { f: string; t: string }[];
  // edge f->t means f must merge BEFORE t (f is a dependency of t)
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const id of ids) { adj.set(id, []); indeg.set(id, 0); }
  const seenEdges = new Set<string>();
  for (const e of edges) {
    // FIXED 2026-09-23 (qwen-code-audit run 3): a `\0` delimiter is ambiguous if
    // an id ever contains one (unreachable for pr:session:num ids, but free to
    // make unambiguous). A JSON pair is injective.
    const ek = JSON.stringify([e.f, e.t]);
    if (seenEdges.has(ek)) continue;
    seenEdges.add(ek);
    if (!indeg.has(e.f) || !indeg.has(e.t)) continue;
    adj.get(e.f)!.push(e.t);
    indeg.set(e.t, indeg.get(e.t)! + 1);
  }
  const queue = ids.filter((id) => indeg.get(id) === 0).sort();
  const order: string[] = [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    order.push(n);
    for (const m of adj.get(n)!.sort()) {
      indeg.set(m, indeg.get(m)! - 1);
      if (indeg.get(m) === 0) queue.push(m);
    }
    queue.sort();
  }
  if (order.length !== ids.length) {
    const orderedSet = new Set(order);
    return { kind: "cycle", nodes: ids.filter((id) => !orderedSet.has(id)).sort() };
  }
  return { kind: "ok", order };
}
