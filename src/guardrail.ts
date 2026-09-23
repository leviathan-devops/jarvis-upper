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
    const row = db.query("SELECT verdict, head_sha FROM gate_pass WHERE pr_node = ? AND gate = ?")
      .get(prId, g) as { verdict: string; head_sha: string | null } | null;
    if (!row || row.verdict !== "pass") { reasons.push(`GATE-MISSING:${g}`); continue; }
    // FIXED 2026-09-23 (ocr round-4 CRITICAL): this compared gate_pass.sha16 (the
    // SPEC INVARIANT hash, per verdict.ts) against pr_node.head_sha (a git commit
    // sha) — CROSS-DOMAIN, so it was always unequal and STALE-GATE fired on every
    // passing gate in production (the tests masked it by writing the head_sha INTO
    // the sha16 column). It now compares the commit the gate RAN AGAINST
    // (gate_pass.head_sha) to the PR's current head.
    if (pr.head_sha !== null && row.head_sha !== null && row.head_sha !== pr.head_sha) {
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
export interface RemoteEligibility { ok: boolean; reasons: string[]; missing: string[]; states: Record<string, string>; }
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
    return { ok: false, reasons: [`REMOTE-FETCH-THREW:${String(e).slice(0, 60)}`], missing: [...REQUIRED_CONTEXTS], states: {} };
  }
  if (!res.ok) {
    return { ok: false, reasons: [`REMOTE-FETCH-FAILED:${res.status}`], missing: [...REQUIRED_CONTEXTS], states: {} };
  }
  let rows: StatusProbe[];
  try {
    rows = (await res.json()) as StatusProbe[];
  } catch (e) {
    return { ok: false, reasons: [`REMOTE-JSON-INVALID:${String(e).slice(0, 60)}`], missing: [...REQUIRED_CONTEXTS], states: {} };
  }
  if (!Array.isArray(rows)) {
    return { ok: false, reasons: ["REMOTE-JSON-NOT-ARRAY"], missing: [...REQUIRED_CONTEXTS], states: {} };
  }
  const latest: Record<string, string> = {};
  for (const r of rows) {
    // FIXED 2026-09-23 (ocr round-4 HIGH): the GitHub /statuses API returns
    // NEWEST FIRST. The old last-wins let the OLDEST status for a context
    // OVERWRITE the newest — a CI re-run flipping factory/verdict
    // failure->success would be ignored, blocking a legitimate merge.
    // FIRST-wins keeps the newest.
    if (!(r.context in latest)) latest[r.context] = r.state;
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
  return { ok: reasons.length === 0, reasons, missing, states: latest };
}

// FIXED 2026-09-23 (ocr final HIGH): the LOCAL gate_pass mirror had NO production
// populator, so head_sha was always NULL and STALE-GATE could never fire. This
// MIRRORS the authoritative remote read into the local table (the guardrail's own
// design: GitHub decides MAY, the DB check is the local mirror of it). Called by
// the runtime tick immediately after guardrailRemote().
export function recordGatePass(db: Database, prId: string, headSha: string, states: Record<string, string>): void {
  for (const g of REQUIRED_GATES) {
    const ctxs = GATE_TO_CONTEXT[g] as readonly string[];
    const ok = ctxs.length > 0 && ctxs.every((c) => states[c] === "success");
    db.query(`INSERT INTO gate_pass(id, pr_node, gate, verdict, head_sha, at)
              VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
              ON CONFLICT(id) DO UPDATE SET verdict=excluded.verdict, head_sha=excluded.head_sha, at=excluded.at`)
      .run(`${prId}:${g}`, prId, g, ok ? "pass" : "fail", headSha);
  }
}
