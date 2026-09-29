// Guardrail: merge eligibility = gates green + sha-bound + deps merged.
// Blocking is the safe default; every block carries its reason rows.
// INVERSION (Plan A-3): GitHub decides MAY; the factory decides ORDER.
// STALE-GATE:<g> is now a MIRROR of GitHub's strict mode (require the same sha /
// branches up to date before merging), not a substitute for it. The DB sha check
// below stays as a local mirror, but the authoritative read is guardrailRemote()
// against REQUIRED_CONTEXTS from the frozen contract.
import { Database } from "bun:sqlite";
import { GATE_TO_CONTEXT, REQUIRED_CONTEXTS, GITHUB_JOB_CONTEXTS, EXTERNAL_GATES } from "./status-contract";

export interface Eligibility {
  ok: boolean;
  reasons: string[];
}

const REQUIRED_GATES = Object.keys(GATE_TO_CONTEXT) as (keyof typeof GATE_TO_CONTEXT)[];

/** FIXED (the red-team audit — CRITICAL A, THE SELF-LATCH):
 *  The publisher was gated on `guardrail().ok`, which includes the gates the factory ITSELF
 *  produces (audit/hardened/fence2 → the two `factory/*` statuses). The tick MIRRORS those
 *  statuses back into `gate_pass` before reading eligibility — so the factory's own published
 *  failure fed back as an input, dropped `eligible` to 0, and the publisher (gated on
 *  eligibility) could NEVER re-publish the correction. MEASURED LIVE: a systemd restart
 *  SIGTERMed the in-flight fence (exit 143), the polarity law published `error`/`failure` to a
 *  real PR, and the daemon has been unable to clear it since.
 *
 *  THE PRINCIPLE: a publisher gates on its INPUTS, never on its OUTPUTS. `publishEligible`
 *  checks the EXTERNAL gates (the GitHub Actions jobs the factory reads) + the readiness + the
 *  sha binding — and NOT the factory's own contexts. `guardrail` (the full set) still governs
 *  the MERGE ORDER, where the factory's verdict is a legitimate requirement.
 *
 *  POSITIVE CONTROL (a regression test must prove BOTH): a PR with green EXTERNAL gates and a
 *  FAILED `factory/fence2` must be publish-eligible (so the correction can go out) while
 *  remaining merge-INeligible (so it cannot merge on a failed verdict). */
/** THE sha-binding gate check — ONE implementation for BOTH the publisher (EXTERNAL gates) and
 *  the merge order (REQUIRED gates). FIXED (the ship gate medium): the two callers held
 *  VERBATIM copies of this loop, so a drift in the binding rule (the exact class this PR fixes)
 *  could silently diverge them. `reasons` is appended in place. */
export function checkGateRows(db: Database, prId: string, gates: readonly string[], reasons: string[], prHead: string | null): void {
  for (const g of gates) {
    const row = db.query("SELECT verdict, head_sha FROM gate_pass WHERE pr_node = ? AND gate = ? ORDER BY at DESC, rowid DESC LIMIT 1")
      .get(prId, g) as { verdict: string; head_sha: string | null } | null;
    // The audit's MEDIUM K: ABSENT (GATE-MISSING) and PRESENT-BUT-FAILED (GATE-FAILED) are distinct.
    if (!row) { reasons.push(`GATE-MISSING:${g}`); continue; }
    if (row.verdict !== "pass") { reasons.push(`GATE-FAILED:${g}:${row.verdict}`); continue; }
    // the sha binding (BOTH sides known; either null = STALE — blocking is the default)
    if (row.head_sha === null || prHead === null || row.head_sha !== prHead) reasons.push(`STALE-GATE:${g}`);
  }
}

export function publishEligible(db: Database, prId: string): Eligibility {
  const reasons: string[] = [];
  const pr = db.query("SELECT id, state, head_sha FROM pr_node WHERE id = ?").get(prId) as
    | { id: string; state: string; head_sha: string | null }
    | null;
  if (!pr) return { ok: false, reasons: ["PR-MISSING"] };
  if (pr.state !== "ready_to_merge") reasons.push(`NOT-READY:${pr.state}`);
  checkGateRows(db, prId, EXTERNAL_GATES, reasons, pr.head_sha);
  return { ok: reasons.length === 0, reasons };
}

export function guardrail(db: Database, prId: string): Eligibility {
  const reasons: string[] = [];
  const pr = db.query("SELECT id, state, head_sha FROM pr_node WHERE id = ?").get(prId) as
    | { id: string; state: string; head_sha: string | null }
    | null;
  if (!pr) return { ok: false, reasons: ["PR-MISSING"] };
  if (pr.state !== "ready_to_merge") reasons.push(`NOT-READY:${pr.state}`);
  checkGateRows(db, prId, REQUIRED_GATES, reasons, pr.head_sha);
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
  // FIXED (round-4 medium): a non-string baseUrl threw at `.replace` before reaching the guard.
  if (opts.baseUrl !== undefined && typeof opts.baseUrl !== "string") {
    return { ok: false, reasons: ["INVALID-BASE-URL:non-string"], missing: [...REQUIRED_CONTEXTS], states: {} };
  }
  const base = (opts.baseUrl ?? "https://api.github.com").replace(/\/$/, "");
  // FIXED (the whole-file scan HIGH): baseUrl was UNVALIDATED — any scheme/host was accepted and
  // received `Authorization: Bearer <token>`, enabling SSRF + token exfil if the base is
  // config-influenced. https-only; the token travels only to an https origin.
  // FIXED (round-4 medium): http://localhost / 127.0.0.1 / [::1] are legitimate dev/mock endpoints
  // (no long-haul token leak over the wire to a remote host). Allowed; every other non-https host
  // is refused.
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/.*)?$/.test(base);
  if (!isLocal && !/^https:\/\/[A-Za-z0-9.-]+(:\d+)?(\/.*)?$/.test(base)) {
    return { ok: false, reasons: [`INVALID-BASE-URL:${base.slice(0, 40)}`], missing: [...REQUIRED_CONTEXTS], states: {} };
  }
  // FIXED (the W27 per-file gate MEDIUM): `.`/`..` passed (encodeURIComponent does not encode
  // dots, so `repos/../..` was reachable) and the sha was not validated as hex.
  const safeSeg = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
  // FIXED 2026-09-23 (qwen-code-audit re-run REAL): a null/undefined sha crashed
  // at `.includes()` instead of returning an honest refusal.
  // FIXED (round-5 low): a length cap (a megabyte-long owner/repo built a huge URL → DoS).
  if (typeof opts.owner !== "string" || typeof opts.repo !== "string" || opts.owner.length > 100 || opts.repo.length > 100 || !safeSeg.test(opts.owner) || !safeSeg.test(opts.repo)) {
    return { ok: false, reasons: [`INVALID-OWNER-REPO:${String(opts.owner)}/${String(opts.repo)}`], missing: [...REQUIRED_CONTEXTS], states: {} };
  }
  // FIXED (the whole-file scan HIGH): the check was an allow-list INVERTED (only `/`, `..`, `\0`
  // rejected) — empty, `.`/`...`, `?`, `#`, and over-long strings all passed into the URL. A real
  // commit sha is hex; require it (the API is only ever asked about a hex commit).
  // FIXED (the whole-file scan HIGH, ADJUDICATED): the sha must be a safe URL SEGMENT (the same
  // rule as owner/repo — REJECTS empty/`?`/`#`/`.`/`..`/whitespace/over-long; accepts any hex or
  // fixture id, so the pinned fetch-path tests' short shas pass). The old check was an allow-list
  // inverted (only `/`, `..`, `\0` rejected).
  // (the same rule as owner/repo) — this rejects empty, `?`, `#`, `.`/`..`, whitespace, and
  // over-long values, while accepting every real sha AND the short fixtures the fetch-path tests use.
  if (typeof opts.sha !== "string" || !safeSeg.test(opts.sha) || opts.sha.length > 100) {
    return { ok: false, reasons: [`INVALID-SHA:${String(opts.sha).slice(0, 12)}`], missing: [...REQUIRED_CONTEXTS], states: {} };
  }
  const url = `${base}/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.repo)}/commits/${encodeURIComponent(opts.sha)}/statuses`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  // FIXED (round-5 medium): a cleartext (http) endpoint would leak the token over the wire —
  // `localhost` can resolve off-loopback via a misconfigured hosts/DNS. The token travels ONLY
  // over https; an http (dev/mock) endpoint gets NO Authorization header.
  if (opts.token && base.startsWith("https://")) headers.Authorization = `Bearer ${opts.token}`;
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
  // FIXED (the W27 per-file gate MEDIUM): a single null/malformed entry threw at `r.context`
  // (breaking the never-throw contract), and `in` consults the PROTOTYPE chain
  // (`"constructor" in {{}}` is true) — a status named `__proto__`/`constructor` polluted the
  // map. Each row is validated, and a NULL-PROTOTYPE map removes the chain entirely.
  const latest: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const r of rows) {
    if (r === null || typeof r !== "object" || typeof (r as { context?: unknown }).context !== "string") continue;
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
    // FIXED (the W27 per-file gate MEDIUM — my OWN W26 bug): haveAll required ALL 8
    // REQUIRED_CONTEXTS, but the 2 `factory/*` ones are COMMIT STATUSES and NEVER appear as
    // check-runs — so the condition could never be true and every call walked 10 pages.
    const haveAll = () => GITHUB_JOB_CONTEXTS.every((c) => byName.has(c));
    let crUrl: string | null = crBase;
    let hops = 0;
    while (crUrl && hops < 10 && !haveAll()) {
      hops++;
      const cur: string = crUrl;
      try {
        const cr = await fetchFn(cur, { headers, signal: AbortSignal.timeout(10000) });
        if (!cr.ok) break;
        // FIXED (the W27 per-file gate MEDIUM): a non-Response / non-JSON resolved value
        // threw outside the guards, and a raw cast let malformed runs through.
        const j = (await cr.json()) as { check_runs?: unknown } | null;
        const rs = j && typeof j === "object" && Array.isArray(j.check_runs) ? j.check_runs : [];
        merge(rs.filter((x): x is Record<string, unknown> => x !== null && typeof x === "object") as never[]);
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
  } catch (e) {
    // W-13: LOG, never swallow. Best-effort the read is — the statuses-only map is kept — but a
    // failed read is NAMED so a persistently broken remote is not indistinguishable from an idle one.
    console.error(`guardrail-remote-read-failed:${String(e).slice(0, 60)}`);
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
  // FIXED (the W27 per-file gate HIGH): `strftime('%s','now')` returns TEXT while LEGACY rows
  // carry INTEGER `at` — and SQLite ranks TEXT > INTEGER, so `ORDER BY at DESC` (the W9
  // "latest verdict" read) compared ACROSS types and could pick the wrong row. `unixepoch()`
  // yields a consistent INTEGER for every write. The mirror is also ONE TRANSACTION so a
  // mid-loop failure can never leave a mixed pass/fail mirror.
  db.exec("BEGIN");
  try {
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
              VALUES (?, ?, ?, ?, ?, unixepoch())
              ON CONFLICT DO UPDATE SET verdict=excluded.verdict, head_sha=excluded.head_sha, at=excluded.at`)
      // FIXED (runs 3-6): a `:`-joined composite key is ambiguous if prId ever
      // contains one. JSON.stringify of the pair is injective.
      .run(JSON.stringify([prId, g]), prId, g, ok ? "pass" : "fail", headSha);
  }
  db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}
