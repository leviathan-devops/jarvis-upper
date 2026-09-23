// adapter-verbs.ts — the adapter's read surface (a real caller for ao-client/client).
// Keeps REST-first: every call goes through the typed client, never the store.
import { call } from "../ao-client/client";
import type { PrRow } from "./sync";

export interface ProjectRow { id: string; name: string }

export async function listProjects(): Promise<ProjectRow[]> {
  const res = await call<{ projects?: ProjectRow[] } | null>("listProjects");
  return (res && typeof res === 'object' && Array.isArray(res.projects) ? res.projects : []) ?? [];
}

export interface SessionRow { id: string; projectId?: string; kind?: string; harness?: string }

// the pr_node.state vocabulary — the SAME set as the store's CHECK constraint.
const PR_STATES = ["open", "ready_to_merge", "merge_ordered", "merged", "rejected", "kicked"] as const;

export async function listSessions(opts: { callFn?: typeof call } = {}): Promise<SessionRow[]> {
  const c = opts.callFn ?? call;
  const res = await c<{ sessions: SessionRow[] } | null>("listSessions");
  // FIXED 2026-09-23 (ocr round-4 HIGH): `res.sessions` threw when the client
  // returned null (the body is `text ? JSON.parse(text) : null`) — the `?? []`
  // only guards the PROPERTY, not the null object. Guard the object too.
  return res && typeof res === "object" && Array.isArray(res.sessions) ? res.sessions : [];
}

// EN-010: the REAL PR lister. Enumerates sessions through the typed client, asks AO
// for each session's PRs, and maps them to rail rows. A reviewer/terminal session
// legitimately has no PRs; a null headSha is preserved as null (never the string).
export async function listPrsFromAo(opts: {
  callFn?: typeof call;
  project?: string;
} = {}): Promise<PrRow[]> {
  const c = opts.callFn ?? call;
  // FIXED 2026-09-23 (ocr round-4 HIGH): the inline `(await c(...)).sessions`
  // crashed when the client returned a null body (the `?? []` guards only the
  // PROPERTY). Reuse the null-safe listSessions so both call sites share one
  // guarded path.
  const sessions = await listSessions({ callFn: c });
  const scoped = opts.project ? sessions.filter((s) => s.projectId === opts.project) : sessions;
  const out: PrRow[] = [];
  const CONC = 8;
  for (let i = 0; i < scoped.length; i += CONC) {
    const batch = scoped.slice(i, i + CONC);
    const results = await Promise.allSettled(batch.map(async (s) => {
      const res = await c<{ sessionId: string; prs?: PrPayload[] } | null>("listSessionPRs", {
        params: { sessionId: s.id },
      });
      const prs = (res && typeof res === 'object' && Array.isArray(res.prs)) ? res.prs : [];
      return prs.map((pr) => ({
        project: s.projectId ?? "unknown",
        pr_number: pr.number,
        session_id: s.id,
        head_sha: pr.headSha ?? null,
        source_branch: pr.sourceBranch ?? null,
        target_branch: pr.targetBranch ?? null,
        // FIXED 2026-09-23 (muse re-review HIGH): `?? "unknown"` is OUTSIDE the
        // pr_node.state CHECK vocabulary, so an event without a state THREW on
        // insert and rolled back the WHOLE sync batch (the same head-of-line
        // block class as the reducers fix). The default is a VALID vocabulary
        // member; an unknown value is clamped to "open" (not applied-as-truth).
        state: (pr.state && PR_STATES.includes(pr.state as typeof PR_STATES[number])) ? pr.state : "open",
        worker_hint: pr.repo ?? null,
      }));
    }));
    for (const r of results) { if (r.status === 'fulfilled') out.push(...r.value); }
  }
  return out;
}

interface PrPayload { number: number; state?: string; repo?: string;
  sourceBranch?: string | null; targetBranch?: string | null; headSha?: string | null }
