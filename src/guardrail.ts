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
    // FIXED (the runtime seat, H2/H5 — MEASURED LIVE): this read had NO ORDER BY, so
    // `.get()` returned whichever row SQLite yielded FIRST. The table's PK is a
    // surrogate `id`, so (pr_node, gate) can hold MANY rows — and a STALE legacy row
    // (id NULL, which never conflicts under a TEXT PK) masked a NEWER verdict.
    // Measured on the live store: ci_green held pass(rowid 1, id NULL) + fail(rowid 5,
    // the live mirror's row) and `.get()` returned the stale PASS. The LATEST verdict
    // now wins deterministically (NULL `at` sorts last under DESC).
    const row = db.query("SELECT verdict, head_sha FROM gate_pass WHERE pr_node = ? AND gate = ? ORDER BY at DESC, rowid DESC LIMIT 1")
      .get(prId, g) as { verdict: string; head_sha: string | null } | null;
    if (!row || row.verdict !== "pass") { reasons.push(`GATE-MISSING:${g}`); continue; }
    // FIXED 2026-09-23 (ocr round-4 CRITICAL): this compared gate_pass.sha16 (the
    // SPEC INVARIANT hash, per verdict.ts) against pr_node.head_sha (a git commit
    // sha) — CROSS-DOMAIN, so it was always unequal and STALE-GATE fired on every
    // passing gate in production (the tests masked it by writing the head_sha INTO
    // the sha16 column). It now compares the commit the gate RAN AGAINST
    // (gate_pass.head_sha) to the PR's current head.
    // FIXED 2026-09-23 (muse independent review HIGH): requiring a NON-NULL row
    // head_sha made a NULL row (a legacy-migrated row, a fixture row) authorize
    // ANY future head — fail-OPEN where this file's own law is "blocking is the
    // safe default". An unknown-commit gate is STALE: the PR's head is known, the
    // gate's is not, so the two cannot be shown to match.
    // FIXED 2026-09-23 (muse re-review HIGH): the old guard skipped the whole
    // check when the PR's head was NULL, so an UNKNOWN CURRENT revision read as
    // eligible. Binding needs BOTH sides KNOWN — either null is STALE (the file's
    // law: blocking is the default, every block carries its reason).
    const gateHead = row.head_sha;
    const prHead = pr.head_sha;
    if (gateHead === null || prHead === null || gateHead !== prHead) {
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
  // FIXED 2026-09-23 (qwen-code-audit re-run REAL): a null/undefined sha crashed
  // at `.includes()` instead of returning an honest refusal.
  if (typeof opts.owner !== "string" || typeof opts.repo !== "string" || !safeSeg.test(opts.owner) || !safeSeg.test(opts.repo)) {
    return { ok: false, reasons: [`INVALID-OWNER-REPO:${String(opts.owner)}/${String(opts.repo)}`], missing: [...REQUIRED_CONTEXTS], states: {} };
  }
  if (typeof opts.sha !== "string" || opts.sha.includes('/') || opts.sha.includes('..') || opts.sha.includes('\0')) {
    return { ok: false, reasons: [`INVALID-SHA:${String(opts.sha).slice(0, 12)}`], missing: [...REQUIRED_CONTEXTS], states: {} };
  }
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
  // FIXED (THE OPERATIONAL GAP — found by driving the kernel end-to-end against the
  // live daemon): the 6 `gates/*` REQUIRED_CONTEXTS are GitHub **CHECK RUNS** (posted
  // by Actions), NOT commit statuses. The /statuses endpoint returns ONLY the 2
  // `factory/*` statuses, so `latest` held 2 of the 8 contexts — every `gates/*` read
  // REMOTE-GATE-MISSING, `ci_green` was ALWAYS `fail`, and **no PR could ever be
  // eligible**. The factory could never do its job. Read the check-runs endpoint too.
  try {
    // FIXED (the W26 ship gate MEDIUM x3 — the pagination was rewritten):
    //  (a) a page-N fetch/json FAILURE jumped to the catch, DISCARDING the runs already
    //      collected on pages 0..N-1 -> a spurious REMOTE-GATE-MISSING;
    //  (b) a RELATIVE `Link: rel="next"` threw in `new URL()` -> pagination aborted early;
    //  (c) the early-exit checked `latest`, which is only merged AFTER the loop -> it never fired.
    // The runs are now merged into `byName` AS THEY ARRIVE, each page is independently
    // guarded, the Link is resolved against the current URL, and the exit checks the MERGED map.
    const crBase = `${base}/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.repo)}/commits/${encodeURIComponent(opts.sha)}/check-runs?per_page=100`;
    // A re-run adds a NEW run for the same name — the LATEST wins.
    const byName = new Map<string, { conclusion: string | null; at: string }>();
    const merge = (rs: { name?: string; conclusion?: string | null; started_at?: string; completed_at?: string | null }[]) => {
      for (const r of rs) {
        if (typeof r.name !== "string" || r.name.length === 0) continue;
        // a missing timestamp sorts LAST (a just-queued run is the newest)
        const at = r.completed_at ?? r.started_at ?? "\uffff";
        const prev = byName.get(r.name);
        if (!prev || at >= prev.at) byName.set(r.name, { conclusion: r.conclusion ?? null, at });
      }
    };
    const haveAll = () => REQUIRED_CONTEXTS.every((c) => byName.has(c));
    let crUrl: string | null = crBase;
    let hops = 0;
    while (crUrl && hops < 10 && !haveAll()) {
      hops++;
      const cur: string = crUrl;
      try {
        const cr = await fetchFn(cur, { headers, signal: AbortSignal.timeout(10000) });
        if (!cr.ok) break;
        const j = (await cr.json()) as { check_runs?: unknown };
        if (Array.isArray(j.check_runs)) merge(j.check_runs as never[]);
        const link = cr.headers?.get?.("link") ?? "";
        const next = /<([^>]+)>;\s*rel="next"/.exec(link);
        if (!next) { crUrl = null; continue; }
        // FIXED (a TOKEN-FORWARDING risk): the next URL was followed VERBATIM while
        // re-sending Authorization — an off-origin Link leaked the token. Resolve RELATIVE
        // references against the CURRENT url, and require the SAME ORIGIN as the base.
        const n: URL = new URL(next[1], cur);
        const same: boolean = n.origin === new URL(base).origin;
        crUrl = same ? n.toString() : null;
        if (crUrl === null) console.error(`check-runs-next-off-origin:${n.origin}`);
      } catch (e) {
        console.error(`check-runs-page-failed:${String(e).slice(0, 60)}`);
        break;   // the runs already merged are KEPT
      }
    }
    if (byName.size > 0) {
      for (const [name, v] of byName) {
        // a check run's NAME IS its context name; a null conclusion = still running.
        // FIXED (ship gate MEDIUM): check-run conclusions use a DIFFERENT vocabulary than
        // commit statuses — `neutral`/`skipped` are NON-BLOCKING (GitHub treats them as
        // passing for required checks), but the later `=== "success"` read them as RED.
        // FIXED (ship gate MEDIUM): the check-run is AUTHORITATIVE for a CI context — the
        // old `!(name in latest)` let a stale commit-status `success` MASK a failing
        // check-run of the same name (a fail-open). The check-run now OVERRIDES.
        const c = v.conclusion ?? "pending";
        latest[name] = c === "neutral" || c === "skipped" ? "success" : c;
      }
    }
  } catch { /* best-effort: a failed check-runs read leaves the statuses-only map (fail-closed) */ }
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
    // FIXED (the ship gate HIGH, round 2): ON CONFLICT(id) missed the UNIQUE(pr_node,gate).
    // FIXED (the W14 ship gate MEDIUM): a named ON CONFLICT target THROWS when the index is
    // ABSENT (a raw test/ad-hoc db). `INSERT OR REPLACE` handles ANY uniqueness violation
    // (the PK or the pair index) with no index dependency.
    // FIXED (the W15 ship gate HIGH): OR REPLACE deletes+inserts, NULLing evidence/sha16
    // that a sibling writer (desks.ts) set for the hardened gate. DO UPDATE with NO target
    // preserves untouched columns + handles any uniqueness with no index-name dependency.
    db.query(`INSERT INTO gate_pass(id, pr_node, gate, verdict, head_sha, at)
              VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
              ON CONFLICT DO UPDATE SET verdict=excluded.verdict, head_sha=excluded.head_sha, at=excluded.at`)
      // FIXED (runs 3-6): a `:`-joined composite key is ambiguous if prId ever
      // contains one. JSON.stringify of the pair is injective.
      .run(JSON.stringify([prId, g]), prId, g, ok ? "pass" : "fail", headSha);
  }
}
