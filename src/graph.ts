// graph.ts: deterministic terminal render of the PR DAG + bug overlay.
import { Database } from "bun:sqlite";

export function renderGraph(db: Database, opts: { bugs?: boolean } = {}): string {
  const nodes = db
    .query("SELECT id, pr_number, state, head_sha, session_id FROM pr_node ORDER BY id")
    .all() as { id: string; pr_number: number; state: string; head_sha: string | null; session_id: string }[];
  if (nodes.length === 0) return "(empty graph)\n";
  const edges = db
    .query("SELECT from_pr AS f, to_pr AS t FROM pr_edge WHERE kind = 'depends_on' ORDER BY f, t")
    .all() as { f: string; t: string }[];
  const mark: Record<string, string> = {};
  if (opts.bugs) {
    const bugs = db.query("SELECT origin_commit, origin_session FROM bug_record WHERE COALESCE(status,'') != 'fixed'")
      .all() as { origin_commit: string | null; origin_session: string | null }[];
    for (const b of bugs) {
      for (const n of nodes) {
        if ((b.origin_session && n.session_id === b.origin_session) ||
            (b.origin_commit && n.head_sha === b.origin_commit)) {
          mark[n.id] = " <-- BUG";
        }
      }
    }
  }
  const lines: string[] = [];
  for (const n of nodes) {
    const sha = (n.head_sha ?? "?").slice(0, 8);
    lines.push(`[${n.id}] #${n.pr_number} ${n.state} ${sha}${mark[n.id] ?? ""}`);
  }
  for (const e of edges) lines.push(`  ${e.f} --depends_on--> ${e.t}`);
  return lines.join("\n") + "\n";
}
