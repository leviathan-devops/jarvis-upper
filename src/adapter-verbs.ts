// adapter-verbs.ts — the adapter's read surface (a real caller for ao-client/client).
// Keeps REST-first: every call goes through the typed client, never the store.
import { call } from "../ao-client/client";
import { PR_STATES } from "./store";
import type { PrRow } from "./sync";

export interface ProjectRow { id: string; name: string }

export async function listProjects(): Promise<ProjectRow[]> {
  const res = await call<{ projects?: ProjectRow[] } | null>("listProjects");
  return (res && typeof res === 'object' && Array.isArray(res.projects) ? res.projects : []) ?? [];
}

export interface SessionRow { id: string; projectId?: string; kind?: string; harness?: string }

// the pr_node.state vocabulary — the SAME set as the store's CHECK constraint.

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
  /** FIXED (ship-gate HIGH): partial-sync errors were console-only, so a caller could
   *  not distinguish a complete sync from a truncated one. This receives every per-session
   *  failure (the loud-fail law, now OBSERVABLE by the caller). */
  // FIXED (ship gate LOW): the runtime supports an async callback (it attaches a .then),
  // so the type must allow it — a `void`-only signature forced a cast at every async caller.
  onPartial?: (errors: { session: string; reason: string }[]) => void | Promise<void>;
} = {}): Promise<PrRow[]> {
  const c = opts.callFn ?? call;
  // FIXED 2026-09-23 (ocr round-4 HIGH): the inline `(await c(...)).sessions`
  // crashed when the client returned a null body (the `?? []` guards only the
  // PROPERTY). Reuse the null-safe listSessions so both call sites share one
  // guarded path.
  const sessions = await listSessions({ callFn: c });
  const scoped = opts.project ? sessions.filter((s) => s.projectId === opts.project) : sessions;
  const out: PrRow[] = [];
  const allErrors: { session: string; reason: string }[] = [];
  const CONC = 8;
  for (let i = 0; i < scoped.length; i += CONC) {
    const batch = scoped.slice(i, i + CONC);
    const errors: { session: string; reason: string }[] = [];
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
    // FIXED 2026-09-23 (qwen-code-audit C1): a REJECTED promise was dropped
    // silently — a failed PR fetch vanished from the sync with no trace. The
    // failure now travels NAMED (the loud-fail law).
    // FIXED (ao-review-4 finding): throwing on the FIRST rejected session discarded
    // every already-resolved session — one failed fetch blocked the whole sync
    // (head-of-line blocking). The failure now travels NAMED (the loud-fail law)
    // but the resolved sessions are kept.
    // FIXED (ocr audit high): the partial-sync failure was console-only (callers
    // could not distinguish complete from partial) and lost its identity. The errors
    // are now COLLECTED with their session and RETURNED — the loud-fail law without
    // head-of-line blocking.
    // FIXED (red-team audit R10 — the previous fix was INCOMPLETE): renaming the
    // loop var was not the bug. `results[k]` corresponds to `batch[k]` (== scoped[i+k]),
    // but the error named `sessions[k]` — the FULL array — so on batch N>0 a failure
    // still reported a batch-0 session id. Index the SAME array the results came from.
    for (let k = 0; k < results.length; k++) {
      const r = results[k];
      if (r.status === 'fulfilled') out.push(...r.value);
      else errors.push({ session: batch[k]?.id ?? `#${i + k}`, reason: String(r.reason).slice(0, 100) });
    }
    if (errors.length > 0) { allErrors.push(...errors); console.error(JSON.stringify({ sync: "PARTIAL", errors })); }
  }
  // FIXED (ship-gate MEDIUM): an UNGUARDED onPartial let a throwing/rejecting caller
  // discard the rows that DID resolve. The callback is best-effort; its failure is named.
  if (allErrors.length > 0) {
    // FIXED (ship gate MEDIUM): a sync try/catch misses an ASYNC callback's rejection
    // (an unhandled rejection). Handle both the throw and the returned thenable.
    // FIXED (ship gate LOW): the type was `void` while an async caller is supported — widen
    // it, and pass a COPY so the caller cannot mutate the accumulated errors.
    try {
      const r = opts.onPartial?.([...allErrors]) as unknown;
      // FIXED (ship gate LOW): a then-ONLY thenable was missed (the .catch check). Check .then.
      if (r && typeof (r as { then?: unknown }).then === "function") {
        (r as Promise<unknown>).catch((e) => console.error(`onPartial-rejected:${String(e).slice(0, 80)}`));
      }
    } catch (e) { console.error(`onPartial-threw:${String(e).slice(0, 80)}`); }
  }
  return out;
}

interface PrPayload { number: number; state?: string; repo?: string;
  sourceBranch?: string | null; targetBranch?: string | null; headSha?: string | null }
