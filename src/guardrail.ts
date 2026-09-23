// Guardrail: merge eligibility = gates green + sha-bound + deps merged.
// Blocking is the safe default; every block carries its reason rows.
// INVERSION (Plan A-3): GitHub decides MAY; the factory decides ORDER.
// STALE-GATE:<g> is now a MIRROR of GitHub's strict mode (require the same sha /
// branches up to date before merging), not a substitute for it. The DB sha check
// below stays as a local mirror, but the authoritative read is guardrailRemote()
// against REQUIRED_CONTEXTS from the frozen contract.
import { Database } from "bun:sqlite";
import { GATE_TO_CONTEXT, REQUIRED_CONTEXTS } from "./status-contract";

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
    // INVERSION: the factory ORDERS (merge_ordered), the human merges. Within one
    // executePlan run the plan is topo-ordered, so a dependency lands in
    // merge_ordered before its dependent is evaluated. Requiring "merged" here
    // would deadlock every multi-PR plan. Token spelling kept (DEP-UNMERGED).
    if (!st || (st.state !== "merged" && st.state !== "merge_ordered")) reasons.push(`DEP-UNMERGED:${d.f}`);
  }
  return { ok: reasons.length === 0, reasons };
}

export interface StatusProbe { context: string; state: string; }
export interface RemoteEligibility { ok: boolean; reasons: string[]; missing: string[]; }
export async function guardrailRemote(
  opts: { owner: string; repo: string; sha: string; token?: string; baseUrl?: string; fetchImpl?: typeof fetch },
): Promise<RemoteEligibility> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const base = (opts.baseUrl ?? "https://api.github.com").replace(/\/$/, "");
  const safeSeg = /^[A-Za-z0-9._-]+$/;
  if (!safeSeg.test(opts.owner) || !safeSeg.test(opts.repo)) throw new Error(`INVALID-OWNER-REPO:${opts.owner}/${opts.repo}`);
  if (opts.sha.includes('/') || opts.sha.includes('..') || opts.sha.includes('\0')) throw new Error(`INVALID-SHA:${opts.sha.slice(0,12)}`);
  const url = `${base}/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.repo)}/commits/${encodeURIComponent(opts.sha)}/statuses`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  // FIXED 2026-09-23 (ocr round-4 HIGH): fetchFn AND res.json() can both throw
  // (network error, AbortSignal timeout, invalid JSON). The function's contract
  // is to RETURN a RemoteEligibility — a throw breaks it and crashes any caller
  // without a try/catch. Both are now caught and returned as an honest not-ok.
  let res: Response;
  try {
    res = await fetchFn(url, { headers, signal: AbortSignal.timeout(10000) });
  } catch (e) {
    return { ok: false, reasons: [`REMOTE-FETCH-THREW:${String(e).slice(0, 60)}`], missing: [...REQUIRED_CONTEXTS] };
  }
  if (!res.ok) {
    return { ok: false, reasons: [`REMOTE-FETCH-FAILED:${res.status}`], missing: [...REQUIRED_CONTEXTS] };
  }
  let rows: StatusProbe[];
  try {
    rows = (await res.json()) as StatusProbe[];
  } catch (e) {
    return { ok: false, reasons: [`REMOTE-JSON-INVALID:${String(e).slice(0, 60)}`], missing: [...REQUIRED_CONTEXTS] };
  }
  if (!Array.isArray(rows)) {
    return { ok: false, reasons: ["REMOTE-JSON-NOT-ARRAY"], missing: [...REQUIRED_CONTEXTS] };
  }
  const latest: Record<string, string> = {};
  for (const r of rows) {
    latest[r.context] = r.state; // last-wins: newer status overrides older
  }
  const reasons: string[] = [];
  const missing: string[] = [];
  for (const ctx of REQUIRED_CONTEXTS) {
    const state = latest[ctx];
    if (state === undefined) {
      reasons.push(`REMOTE-GATE-MISSING:${ctx}`);
      missing.push(ctx);
    } else if (state !== "success") {
      reasons.push(`REMOTE-GATE-RED:${ctx}:${state}`);
      missing.push(ctx);
    }
  }
  return { ok: reasons.length === 0, reasons, missing };
}
