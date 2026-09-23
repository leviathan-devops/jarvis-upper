// Idempotent event reducers: events are hints, API rows are truth.
// Reducer key = (source, seq) via rail cursor; every reducer MUST be
// safe to run twice for the same event (upsert-only, no counters).
import { Database } from "bun:sqlite";
import type { RailEvent } from "../ao-client/rail";

export type ReduceOutcome = "applied" | "cursor-only";

export function reduceEvent(db: Database, ev: RailEvent): ReduceOutcome {
  const d: unknown = ev.data;
  if (ev.type === "pr_state_changed" && d !== null && typeof d === "object") {
    const rec = d as Record<string, unknown>;
    const rawPr = "pr" in rec ? rec.pr : d;
    const pr = (rawPr !== null && typeof rawPr === "object" ? rawPr : {}) as Record<string, unknown>;
    const num = Number(pr.number ?? pr.pr_number);
    const rawSession = pr.session_id ?? pr.sessionId ?? rec.sessionId ?? "";
    const sessionId = typeof rawSession === "string" || typeof rawSession === "number" ? String(rawSession) : "";
    if (Number.isFinite(num) && sessionId !== "") {
      const id = `pr:${sessionId}:${num}`;
      const rawProject = rec.projectId ?? rec.project ?? "";
      const project = typeof rawProject === "string" || typeof rawProject === "number" ? String(rawProject) : "";
      const rawState = pr.state ?? "open";
      const state = typeof rawState === "string" ? rawState : "open";
      const rawHead = pr.head_sha;
      const head = typeof rawHead === "string" ? rawHead : null;
      // FIXED 2026-09-23 (ocr round-4 HIGH): an event WITHOUT a head_sha set
      // `head=null`, and the conflict clause overwrote the stored head_sha with
      // NULL — permanent data loss. COALESCE keeps the existing value when the
      // incoming one is null.
      db.query(`INSERT INTO pr_node(id, project, pr_number, session_id, head_sha, state, minted_at)
                VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'))
                ON CONFLICT(id) DO UPDATE SET state=excluded.state, head_sha=COALESCE(excluded.head_sha, pr_node.head_sha)`)
        .run(id, project, num, sessionId, head, state);
      return "applied";
    }
  }
  return "cursor-only";
}
