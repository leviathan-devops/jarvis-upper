// cli-verbs.ts — the operator surface: one JSON object per verb on stdout,
// exit 0 (ok) / 1 (negative verdict) / 2 (refused or usage).
// Each verb is a CALLER for a library module (graph, attribute, desks, ...).
import { Database } from "bun:sqlite";
import { kick } from "./kick";
import { daemonKickDeps } from "./kick-adapter";
import { openStore } from "./store";
import { orderMerges } from "./plan";
import { guardrail } from "./guardrail";
import { renderGraph } from "./graph";
import { attributeBug, CONFIDENCE_FLOOR } from "./attribute";
import { parseTickMs } from "./runtime";
import { executePlan, type MergeAdapter } from "./execute";
import { waveA, waveB, waveC, waveD } from "./desks";
import { readStatus } from "./status";
import { resolveStorePath } from "./projects";
import { syncPrs } from "./sync";
import { listProjects, listPrsFromAo } from "./adapter-verbs";

export interface VerbResult { code: number; out: Record<string, unknown> }

const emit = (code: number, out: Record<string, unknown>): VerbResult => ({ code, out });

/** FIXED (the ship gate medium): `resolveStorePath` can THROW (AMBIGUOUS-STORE / NO-PROJECT /
 *  REGISTRY-BROKEN). Evaluated inline it escaped the verb's try/finally and surfaced as a bare
 *  VERB-THREW stack. This wrapper converts the refusal into the verb CONTRACT's shape — a
 *  VerbResult-shaped NamedRefusal carried on a sentinel Database-free path. */
// FIXED (the ship gate HIGH): a subclass that sets no `name` stringifies as "Error: ...", so
// cli.ts's `startsWith("StoreRefusal:")` was DEAD. The name is set explicitly.
export class StoreRefusal extends Error {
  override readonly name = "StoreRefusal";
}
function storeFor(root: string): Database {
  try { return openStore(resolveStorePath(root)); }
  catch (e) {
    // FIXED (ship gate medium): `(e as Error).message` throws on a null/undefined throw, and
    // `??` keeps "". A null-safe message with a non-empty fallback.
    const msg = e instanceof Error ? e.message : String(e);
    throw new StoreRefusal(msg || "STORE-RESOLUTION-FAILED");
  }
}

export async function verbStatus(root: string, _arg?: string): Promise<VerbResult> {
  const s = readStatus(root);
  if (!s) return emit(1, { ok: false, verdict: "NO-STATUS-FILE", hint: "start src/main.ts" });
  const ageMs = Date.now() - Date.parse(s.ts);
  // FIXED (SLOP-01) then (ship gate MEDIUM): the inline copy was a 3rd authority for
  // one parse. It now REUSES the runtime's exported parseTickMs — one implementation.
  const tickMs = parseTickMs(process.env.UPPER_TICK_MS);
  const fresh = ageMs < 2 * tickMs;
  // FIXED 2026-09-23 (ocr round-4 HIGH): a nested ternary — the review
  // checklist prohibits it. Sequential if/else, each condition independent.
  let verdict: "DOWN" | "RUNNING" | "STALE";
  if (!s.daemonOk) verdict = "DOWN";
  else if (fresh) verdict = "RUNNING";
  else verdict = "STALE";
  return emit(verdict === "RUNNING" ? 0 : 1, { ok: verdict === "RUNNING", verdict, ageMs, tick: s.tick, cursor: s.cursor, prNodes: s.prNodes, planKind: s.planKind });
}

export async function verbPlan(root: string, _arg?: string): Promise<VerbResult> {
  const db = storeFor(root);
  try {
  const v = orderMerges(db);
  if (v.kind === "cycle") return emit(1, { ok: false, kind: "cycle", nodes: v.nodes });
  const hash = new Bun.CryptoHasher("sha256").update(v.order.join(",")).digest("hex").slice(0, 16);
  return emit(0, { ok: true, kind: "ok", order: v.order, hash });
  } finally { db.close(); }
}

export async function verbOrder(root: string, arg?: string): Promise<VerbResult> {
  if (arg !== "--confirm") {
    return emit(2, { ok: false, refused: "UNCONFIRMED-PLAN", hint: "capabilities execute in-process with {confirm:true}; no CLI merge path" });
  }
  const db = storeFor(root);
  try {
  const adapter: MergeAdapter = { publish: async () => ({ ok: false }) };
  const r = await executePlan(db, adapter, { confirm: true });
  // FIXED 2026-09-23 (qwen-code-audit re-run REAL): executePlan can return a
  // PARTIAL execution (haltedAt set); the verb always returned code 0, so a
  // halted plan read as success. A halt is a negative verdict (exit 1).
  const halted = r.haltedAt !== null;
  return emit(halted ? 1 : 0, { ok: !halted, planId: r.planId, merged: r.merged, haltedAt: r.haltedAt, haltReason: r.haltReason });
  } finally { db.close(); }
}

export async function verbGraph(root: string, _arg?: string): Promise<VerbResult> {
  const db = storeFor(root);
  try {
  const g = renderGraph(db, { bugs: true });
  return emit(0, { ok: true, graph: g });
  } finally { db.close(); }
}

export async function verbGates(root: string, _arg?: string): Promise<VerbResult> {
  const db = storeFor(root);
  try {
  const ready = db.query("SELECT id FROM pr_node WHERE state='ready_to_merge'").all() as { id: string }[];
  const checks = ready.map((r) => ({ pr: r.id, ...guardrail(db, r.id) }));
  return emit(0, { ok: true, ready: ready.length, eligible: checks.filter((c) => c.ok).length, checks });
  } finally { db.close(); }
}

export async function verbSync(root: string, arg?: string): Promise<VerbResult> {
  const db = storeFor(root);
  try {
  // FIXED 2026-09-23 (ocr confirm HIGH): listProjects() ran BEFORE the try, so a
  // throw there skipped the db cleanup path (and the error was not shaped as a
  // VerbResult). It is inside the try now.
  const projects = await listProjects();
  // FIXED (round-4 medium + round-5 medium ×2): a typo'd project silently synced nothing; the
  // guard now runs even for an EMPTY fleet, and normalizes arg to the id the downstream filter
  // (`s.projectId === arg`) actually uses — a matching NAME was passing the guard yet syncing 0.
  if (arg) {
    const match = projects.find((p) => p.name === arg || (p as { id?: string }).id === arg);
    if (!match) return emit(2, { ok: false, refused: "SYNC-NO-SUCH-PROJECT", project: arg.slice(0, 64),
      known: projects.map((p) => ({ name: p.name, id: (p as { id?: string }).id })).slice(0, 20),
      knownCount: projects.length });
    // FIXED (round-6 medium): falling back to `match.name` reintroduced the silent-0 sync — the
    // adapter filters on `s.projectId === arg`, so a NAME never matches. Resolve to the id ONLY;
    // a row without an id is a named refusal.
    // FIXED (round-7 low): truthiness does not guarantee a STRING id — a malformed row with a
    // numeric id would pass and never match. Require a non-empty string.
    const mid = (match as { id?: unknown }).id;
    if (typeof mid !== "string" || mid.length === 0) return emit(2, { ok: false, refused: "SYNC-PROJECT-NO-ID", project: arg.slice(0, 64) });
    arg = mid;
  }
  // FIXED (W26): listPrsFromAo returns { rows, partialErrors }.
  const ao = await listPrsFromAo({ project: arg });
  const { rows: n, skipped } = await syncPrs(db, async () => ao.rows);
  const prs = db.query("SELECT COUNT(*) AS n FROM pr_node WHERE state != 'merged'").get() as { n: number };
  // FIXED (the whole-file scan HIGH): the verb reported ok:true while DROPPING `skipped` and the
  // adapter's partialErrors, and misreported the fleet size for a single-project sync. All named;
  // a partial sync is NOT ok.
  const partialErrors = ao.partialErrors ?? [];
  const ok = skipped.length === 0 && partialErrors.length === 0;
  // FIXED (round-4 low): the truncation was lossy; TOTALS are exposed and both lists bounded.
  return emit(ok ? 0 : 1, { ok, synced: arg ?? "(fleet)", prNodes: n, openPrNodes: prs.n,
    projects: projects.length,
    skipped: skipped.slice(0, 20), skippedCount: skipped.length,
    partialErrors: partialErrors.slice(0, 20), partialErrorCount: partialErrors.length });
  } finally { db.close(); }
}

export async function verbBug(root: string, arg?: string): Promise<VerbResult> {
  const db = storeFor(root);
  try {
  if (!arg) {
    const bugs = db.query("SELECT id, status, origin_commit FROM bug_record ORDER BY created_at DESC LIMIT 20").all();
    return emit(0, { ok: true, bugs });
  }
  // F34: split on last ':' to support paths containing ':'
  const colonIdx = arg.lastIndexOf(":");
  const file = colonIdx > 0 ? arg.slice(0, colonIdx) : arg;
  const lineStr = colonIdx > 0 ? arg.slice(colonIdx + 1) : undefined;
  const line = Number(lineStr ?? 1);
  if (!Number.isFinite(line) || line < 1) return emit(2, { ok: false, refused: "INVALID-LINE", hint: "upper bug <file>:<positive-integer>" });
  const a = await attributeBug( { repo: root, files: [file], lines: { [file]: [line] } }, async () => ({ session: null, worker: null }));
  // FIXED (red-team audit R12): the 0.6 here was a SECOND authority duplicating
  // attribute.ts's CONFIDENCE_FLOOR — two thresholds that could drift apart. One import.
  return emit(a.confidence >= CONFIDENCE_FLOOR ? 0 : 1, { ok: a.confidence >= CONFIDENCE_FLOOR, commit: a.commit, confidence: a.confidence, method: a.method, floor: CONFIDENCE_FLOOR });
  } finally { db.close(); }
}

export async function verbDesks(root: string, arg?: string): Promise<VerbResult> {
  const fx = { root: `${root}/runtime/fixtures/w4` };
  const db = storeFor(root);
  try {
  if (arg === "run") {
    const a = await waveA(db, fx, "w4");
    const b = await waveB(db, fx, "w4");
    const c = await waveC(db, fx, `w4-cli-${Date.now().toString(36)}`);
    const d = await waveD(db, fx);
    return emit(0, { ok: true, waveA: a.files, waveB: b.token, waveC: c.recorded, waveD: d.verdicts });
  }
  return emit(0, { ok: true, desks: ["waveA-assemble", "waveB-harden", "waveC-audit", "waveD-research"], hint: "run: upper desks run" });
  } finally { db.close(); }
}

/**
 * verbKick — dispatch a bug fix. WIRED (red-team audit R9): the daemon adapter
 * (src/kick-adapter.ts) supplies the transport, so this is no longer a stub. The
 * kick() dossier-hash gate still refuses a tampered dossier before any send.
 */
export async function verbKick(root: string, arg?: string, mode?: string): Promise<VerbResult> {
  if (!arg) return emit(2, { ok: false, refused: "KICK-NEEDS-BUG-ID", hint: "upper kick <bug-id> [live|spawn|direct]" });
  // FIXED (ship-gate MEDIUM x2): an unknown mode silently auto-selected, and the raw arg
  // flowed into `git checkout -b fix/${bugId}` (spaces/slashes/.. make an invalid ref).
  if (mode !== undefined && mode !== "" && mode !== "live" && mode !== "spawn" && mode !== "direct") {
    // FIXED (ship gate LOW): the mode is a CLI arg echoed into JSON/logs — bound it.
    return emit(2, { ok: false, refused: `KICK-BAD-MODE:${String(mode).slice(0, 32)}`, hint: "live | spawn | direct" });
  }
  // FIXED (the W24 ship gate LOW): this allowed `.`/`..`/`---` (invalid git refs). Require an
  // alphanumeric, matching the adapter's own gate — fail fast at the CLI boundary.
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(arg) || !/[A-Za-z0-9]/.test(arg)) {
    // FIXED (the W17 ship gate LOW): `arg` is arbitrary-length here — bound the echo.
    return emit(2, { ok: false, refused: "KICK-BAD-BUG-ID", bugId: String(arg).slice(0, 64), hint: "an id matching /^[A-Za-z0-9._-]{1,64}$/" });
  }
  const db = storeFor(root);
  try {
    const bug = db.query("SELECT id, dossier_path, origin_commit, origin_session FROM bug_record WHERE id = ?").get(arg) as
      { id: string; dossier_path: string | null; origin_commit: string | null; origin_session: string | null } | null;
    if (!bug) return { code: 1, out: { ok: false, refused: "NO-SUCH-BUG", bugId: arg } };
    if (!bug.dossier_path) return { code: 1, out: { ok: false, refused: "NO-DOSSIER-PATH", bugId: arg } };
    const m = (mode === "live" || mode === "spawn" || mode === "direct") ? mode : undefined;
    const res = await kick(db, daemonKickDeps({ cwd: root }), {
      bugId: arg,
      // FIXED (ship gate LOW): `||` fixes "" but "   " is truthy — trim then fall back.
      projectId: (process.env.UPPER_PROJECT_ID ?? "").trim() || "jarvis-upper",
      originSession: bug.origin_session,
      originCommit: bug.origin_commit ?? "unknown",
      dossierPath: bug.dossier_path,
      mode: m,
    });
    // FIXED (the W20 ship gate LOW): every FAILURE path names the bugId; the success path
    // did not — a caller could not correlate the output without re-passing the input.
    // FIXED (the W26 ship gate LOW): a future KickResult key could overwrite `ok`/`bugId`.
    // The stable correlation fields go LAST.
    return { code: 0, out: { ...res, ok: true, bugId: arg } };
  } catch (e) {
    return { code: 1, out: { ok: false, refused: "KICK-FAILED", bugId: arg, error: String(e).slice(0, 140) } };
  } finally { db.close(); }
}

/**
 * verbPromote — THE OPERATOR'S PROMOTION STEP, AS A SUPPORTED COMMAND.
 * FIXED (red-team audit TH-3/F-19): nothing in src/ ever set state='ready_to_merge',
 * so the ONLY way a PR became eligible was a raw hand-INSERT — and a green produced
 * that way was reported as the kernel's own achievement. Promotion is a legitimate
 * HUMAN step (the factory decides ORDER; a human decides readiness), so it now has a
 * named, logged verb instead of an ad-hoc SQL statement.
 */
export async function verbPromote(root: string, arg?: string): Promise<VerbResult> {
  if (!arg) return { code: 2, out: { ok: false, refused: "PROMOTE-NEEDS-ID", hint: "promote <pr_node id>" } };
  const db = storeFor(root);
  try {
    const row = db.query("SELECT id, state, head_sha FROM pr_node WHERE id = ?").get(arg) as
      { id: string; state: string; head_sha: string | null } | null;
    if (!row) return { code: 1, out: { ok: false, refused: "NO-SUCH-PR", id: arg } };
    if (!row.head_sha) return { code: 1, out: { ok: false, refused: "NO-HEAD-SHA", id: arg } };
    if (row.state !== "open") {
      return { code: 1, out: { ok: false, refused: `NOT-PROMOTABLE:${row.state}`, id: arg, hint: "only an 'open' row promotes" } };
    }
    db.query("UPDATE pr_node SET state='ready_to_merge' WHERE id = ?").run(arg);
    return { code: 0, out: { ok: true, promoted: arg, head_sha: row.head_sha, note: "eligibility only — the fence+review must still verify" } };
  } finally { db.close(); }
}

/**
 * verbEnroll — PUT THE KERNEL ON A PROJECT.
 * Usage: upper enroll <target-path> <project-id> <owner> <repo>
 * Copies gates/ + .githooks/ + the workflows + the vendored package, and writes the registry
 * entry. It does NOT arm the ruleset (that is verbArm) because the ruleset must be armed
 * against the OBSERVED check-run names — the workflows must run once first.
 */
export async function verbEnroll(root: string, arg?: string, ...rest: string[]): Promise<VerbResult> {
  const [id, owner, repo] = rest;
  if (!arg || !id || !owner || !repo) {
    return emit(2, { ok: false, refused: "ENROLL-NEEDS-ARGS", hint: "upper enroll <target-path> <project-id> <owner> <repo> [tokenEnv] [--dry-run]" });
  }
  const { enroll } = await import("./enroll");
  const tokenEnv = rest[3] && !rest[3].startsWith("--") ? rest[3] : "GH_TOKEN";
  const dryRun = rest.includes("--dry-run");
  const r = enroll({ kernel: root, target: arg, id, owner, repo, tokenEnv, dryRun });
  // FIXED (ship gate high): a COPY-FAILED path is in `r.skipped` — surfaced distinctly so a
  // caller sees the failures, and r.ok is false (enroll.ts computes it).
  const copyFailed = r.skipped.filter((s) => s.includes("COPY-FAILED"));
  return emit(r.ok ? 0 : 2, { ...r, dryRun, copyFailed, next: r.ok ? [`upper arm ${id}   # AFTER the workflows have run once`, `git -C ${arg} config core.hooksPath .githooks`] : undefined });
}

/**
 * verbArm — ARM THE RULESET ON A PROJECT.
 * Usage: upper arm <project-id> [--no-factory]
 * POSTs the 8-context ruleset (bypass_actors: []) to the project's repo. This is the step that
 * makes every gate UNBYPASSABLE — the local hooks are advisory, THIS is the anchor.
 */
export async function verbArm(root: string, arg?: string, ...rest: string[]): Promise<VerbResult> {
  if (!arg) return emit(2, { ok: false, refused: "ARM-NEEDS-ID", hint: "upper arm <project-id> [--no-factory]" });
  const { loadRegistry, projectToken } = await import("./projects");
  const { rulesetFor } = await import("./enroll");
  // FIXED (the ship gate low): validate the FLAGS before any registry I/O / credential work.
  const known = new Set(["--no-factory"]);
  const unknown = rest.filter((x) => !known.has(x));
  if (unknown.length > 0) return emit(2, { ok: false, refused: "ARM-UNKNOWN-FLAG", id: arg, unknown: unknown.map((u) => u.slice(0, 40)), known: [...known] });
  const reg = loadRegistry(root, process.env);
  const spec = reg.projects.find((p) => p.id === arg);
  if (!spec) return emit(2, { ok: false, refused: "ARM-NO-SUCH-PROJECT", id: arg, known: reg.projects.map((p) => p.id) });
  const token = projectToken(spec);
  if (!token) return emit(1, { ok: false, refused: `ARM-DISARMED:no ${spec.tokenEnv}`, id: arg });
  // FIXED (the audit HIGH G — `arm` was NON-IDEMPOTENT and violated its own ORDER LAW):
  //  (a) it POSTed unconditionally (a second `arm` created a DUPLICATE ruleset), and
  //  (b) it hardcoded `factoryContexts: true` while enroll.ts documents that arming a DISARMED
  //      project installs a ruleset requiring two contexts its daemon will NEVER post —
  //      "the merge button dead with every check green". The flag is derived from whether the
  //      daemon can actually publish (does the project's token resolve — the `token` above).
  //  (c) the documented `[--no-factory]` was unreachable.
  // (the unknown-flag refusal now runs BEFORE the I/O above)
  const factoryContexts = !rest.includes("--no-factory");
  const payload = rulesetFor({ factoryContexts });
  const base = `https://api.github.com/repos/${encodeURIComponent(spec.owner)}/${encodeURIComponent(spec.repo)}/rulesets`;
  const hdrs = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" };
  try {
    // GET → RECONCILE: list the existing rulesets; if ours is present, PUT (idempotent update),
    // else POST. A repeated `arm` now converges instead of duplicating.
    // FIXED (the ship gate HIGH): a 401/403/404 GET was swallowed by `.catch(()=>[])`, so an
    // AUTH FAILURE fell through to a write attempt, and a ruleset beyond the first page could be
    // missed → a DUPLICATE create. The GET is checked and paginated-safely handled.
    // FIXED (the ship gate medium): follow Link rel=next (bounded), so a matching ruleset beyond
    // the first page is found — never a duplicate create.
    let listUrl: string | null = `${base}?per_page=100`;
    let hops = 0;
    let existing: { id: number; name: string } | undefined;
    while (listUrl && hops < 5 && !existing) {
      hops++;
      // FIXED (the whole-file scan medium): no timeout — a hung GET hung the CLI forever.
      const listRes = await fetch(listUrl, { headers: hdrs, signal: AbortSignal.timeout(10000) });
      if (!listRes.ok) return emit(1, { ok: false, refused: `ARM-LIST-FAILED:${listRes.status}`, id: arg, hint: listRes.status === 403 ? "a private repo needs GitHub Pro for rulesets / the token is bad" : undefined });
      const page = await listRes.json().catch(() => null);
      if (!Array.isArray(page)) return emit(1, { ok: false, refused: "ARM-LIST-UNREADABLE", id: arg });
      existing = (page as { id: number; name: string }[]).find((r) => r.name === (payload as { name?: string }).name);
      const link = listRes.headers?.get?.("link") ?? "";
      const nx = /<([^>]+)>;\s*rel="next"/.exec(link);
      const cand: URL | null = nx ? new URL(nx[1], listUrl) : null;
      listUrl = cand && cand.origin === new URL(base).origin ? cand.toString() : null;
    }
    const url = existing ? `${base}/${existing.id}` : base;
    const res = await fetch(url, { method: existing ? "PUT" : "POST", headers: hdrs, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return emit(1, { ok: false, refused: `ARM-FAILED:${res.status}`, id: arg, message: (body as { message?: string }).message?.slice(0, 200), hint: res.status === 403 ? "a private repo needs GitHub Pro for rulesets" : undefined });
    // FIXED (the ship gate medium): the reported context COUNT is now DERIVED from the installed
    // payload — the hardcoded `8 : 6` would lie if a job is added/removed.
    // FIXED (ship gate medium): optional chaining — a missing `rules` cannot throw inside try.
    const rs = (payload as { rules?: { type: string; parameters?: { required_status_checks?: unknown[] } }[] }).rules;
    const nCtx = (rs?.find((r) => r.type === "required_status_checks")?.parameters?.required_status_checks ?? []).length;
    return emit(0, { ok: true, armed: arg, repo: `${spec.owner}/${spec.repo}`, rulesetId: (body as { id?: number }).id, action: existing ? "updated" : "created", factoryContexts, contexts: nCtx });
  } catch (e) {
    // FIXED (round-4 low): a TIMEOUT is named distinctly from a generic throw.
    const name = (e as { name?: string } | null | undefined)?.name;   // FIXED (round-5 medium): null-safe
    const refused = name === "TimeoutError" || name === "AbortError" ? "ARM-TIMEOUT" : "ARM-THREW";
    return emit(1, { ok: false, refused, id: arg, error: String(e).slice(0, 160) });
  }
}

/**
 * verbAttach — THE ONE-CLICK ONBOARDING.
 * Usage: upper attach <path> [--id X] [--owner O] [--repo R] [--token-env E] [--host H]
 *                             [--dry]
 * ONE idempotent verb: the 8 gated steps (preflight → derive → repo gate → remote gate → wiring
 * → hooks gate → registry merge → verify); every refusal a NAMED token + the exact remedy.
 * `--dry` prints the plan and changes NOTHING. A second run reports noop.
 */
export async function verbAttach(root: string, arg?: string, ...rest: string[]): Promise<VerbResult> {
  if (!arg) {
    return emit(2, { ok: false, refused: "ATTACH-NEEDS-A-PATH", hint: "upper attach <path> [--id X] [--owner O] [--repo R] [--token-env E] [--host H] [--dry]" });
  }
  const known = new Set(["--id", "--owner", "--repo", "--token-env", "--host", "--dry", "--visibility", "--no-provision"]);
  const opts: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const f = rest[i];
    if (!known.has(f)) return emit(2, { ok: false, refused: "ATTACH-UNKNOWN-FLAG", flag: f.slice(0, 40), known: [...known] });
    if (f === "--dry" || f === "--no-provision") { opts[f.slice(2)] = true; continue; }
    const v = rest[++i];
    if (v === undefined) return emit(2, { ok: false, refused: "ATTACH-FLAG-NEEDS-A-VALUE", flag: f });
    opts[f.slice(2)] = v;
  }
  const { attachPlan, attachApply } = await import("./attach");
  const { realDeps } = await import("./attach-guards");
  const { provisionRepo } = await import("./repo-visibility");
  // FR-13 (the operator's standing order, 2026-10-02): the kernel OWNS the repo's existence and
  // visibility — "make all repos public by default ... dont leave any stupid bs for me to manage".
  // The default is PUBLIC with auto-provision ON; `--no-provision` restores the refusal-only path.
  const wantVis = (opts["visibility"] as "public" | "private" | undefined) ?? "public";
  if (wantVis !== "public" && wantVis !== "private") {
    return emit(2, { ok: false, refused: "ATTACH-BAD-VISIBILITY", hint: "--visibility public|private" });
  }
  const autoProvision = opts["no-provision"] !== true;

  const tokenEnv = (opts["token-env"] as string | undefined) ?? "GH_TOKEN";
  // the credential resolves from the ENV-VAR NAME — never from a flag, never persisted.
  const token = process.env[tokenEnv] ?? "";
  // FIXED (the audit gate HIGH): a RELATIVE path was stored verbatim in the registry, and
  // `checkProject` requires root/worktreeRoot/store to be ABSOLUTE — so `upper attach ./tree`
  // wrote an entry the daemon immediately rejected (the REGISTRY-EMPTY fallback). Resolve it here.
  const absPath = (await import("node:path")).resolve(arg);
  const attachOpts = {
    path: absPath,
    id: opts.id as string | undefined,
    owner: opts.owner as string | undefined,
    repo: opts.repo as string | undefined,
    tokenEnv,
    host: (opts.host as string | undefined) ?? ((process.env.UPPER_HOST ?? "").trim() || "github.com"),
    token,
  };
  const deps = realDeps(root, attachOpts.host);
  const mapSteps = (p: Awaited<ReturnType<typeof attachPlan>>) =>
    p.steps.map((s) => ({ n: s.n, id: s.id, ok: s.ok, mutates: s.mutates, detail: s.detail, ...(s.refused ? { refused: s.refused, remedy: s.remedy } : {}) }));
  try {
    let plan = await attachPlan(attachOpts, deps);
    // FR-13 — THE SELF-HEAL: `ATTACH-NO-REPO` and `ATTACH-PRIVATE-FREE-REPO` were the two refusals
    // that demanded an operator click. With auto-provision ON (the default) the kernel PROVISIONS
    // (create-if-absent / flip-to-public) and RE-PLANS; the refusal survives as the fallback when
    // the kernel CANNOT act (no token, no scope, a probe failure) — the operator's "dont leave any
    // stupid bs for me to have to manage", with the honest failure path intact.
    const PROVISIONABLE = /^ATTACH-(NO-REPO|PRIVATE-FREE-REPO)/;
    let provision: { did: string[]; detail: string } | undefined;
    const wouldProvision = !!(plan.refused && PROVISIONABLE.test(plan.refused) && autoProvision);
    if (wouldProvision && !opts.dry) {
      const p = provisionRepo(
        { owner: plan.target.owner, repo: plan.target.repo, root: plan.target.root },
        { visibility: wantVis, create: true },
        token,
      );
      provision = { did: p.did, detail: p.detail };
      if (!p.ok) {
        return emit(2, { ok: false, refused: p.refused, remedy: p.remedy, target: plan.target, provision, steps: mapSteps(plan) });
      }
      plan = await attachPlan(attachOpts, deps);   // RE-PLAN — the repo now satisfies the gate
    }
    const steps = mapSteps(plan);
    if (opts.dry) {
      return emit(plan.refused ? 1 : 0, {
        ok: !plan.refused, dry: true, target: plan.target, steps, mutations: plan.mutations,
        ...(wouldProvision ? { wouldProvision: `create/flip ${plan.target.owner}/${plan.target.repo} → ${wantVis}` } : {}),
        ...(plan.refused ? { refused: plan.refused, remedy: plan.remedy } : {}),
      });
    }
    if (plan.refused) {
      return emit(2, { ok: false, refused: plan.refused, remedy: plan.remedy, target: plan.target, steps });
    }
    const res = await attachApply(plan, attachOpts, deps);
    return emit(res.applied ? 0 : 2, {
      ok: res.applied, attached: res.applied ? res.target.id : undefined, target: res.target,
      action: res.mutations === 0 ? "noop" : "applied", report: res.report,
      ...(res.refused ? { refused: res.refused, remedy: res.remedy } : {}),
    });
  } catch (e) {
    return emit(1, { ok: false, refused: "ATTACH-THREW", error: String(e).slice(0, 200) });
  }
}

/**
 * verbVis — THE VISIBILITY DIAL (FR-13, BOTH directions).
 * Usage: upper vis <id|path> --public | --private
 * The operator's explicit override: an EXISTING repo is flipped to the asked visibility.
 * An absent repo refuses (creating is `attach`'s job — there the identity + remote are resolved);
 * the refusal carries the create remedy so nothing is a dead end.
 */
export async function verbVis(root: string, arg?: string, ...rest: string[]): Promise<VerbResult> {
  if (!arg) return emit(2, { ok: false, refused: "VIS-NEEDS-A-TARGET", hint: "upper vis <id|path> --public|--private" });
  const want = rest.includes("--public") ? "public" as const : rest.includes("--private") ? "private" as const : undefined;
  if (!want) return emit(2, { ok: false, refused: "VIS-NEEDS-A-VISIBILITY", hint: "upper vis <id|path> --public|--private (the alter works BOTH ways)" });
  const { provisionRepo, resolveTargetForVis } = await import("./repo-visibility");
  const { loadRegistry } = await import("./projects");
  const { parseOrigin } = await import("./attach");

  let t: { owner: string; repo: string; root: string; host: string };
  const reg = loadRegistry(root, process.env);
  const hit = resolveTargetForVis(arg, reg);
  if ("error" in hit) {
    // a PATH outside the registry: derive the identity from the tree's own origin.
    let origin = "";
    try {
      const r = Bun.spawnSync(["git", "-C", arg, "remote", "get-url", "origin"], { stderr: "pipe", stdout: "pipe" });
      if (r.exitCode === 0) origin = (r.stdout?.toString() ?? "").trim();
    } catch (e) { console.error(`vis-origin-read:${arg}:${String(e).slice(0, 50)}`); }
    const parsed = origin ? parseOrigin(origin) : null;
    if (!parsed) {
      return emit(2, { ok: false, refused: "VIS-NO-TARGET", detail: hit.error, hint: `git -C ${JSON.stringify(arg)} remote add origin git@github.com:<owner>/<repo>.git   # or use a registered id` });
    }
    t = { owner: parsed.owner, repo: parsed.repo, root: (await import("node:path")).resolve(arg), host: parsed.host };
  } else {
    t = hit;
  }

  const tokenEnv = (process.env.UPPER_TOKEN_ENV ?? "GH_TOKEN").trim() || "GH_TOKEN";
  const token = process.env[tokenEnv] ?? "";
  const p = provisionRepo({ owner: t.owner, repo: t.repo, root: t.root }, { visibility: want, create: false }, token);
  return emit(p.ok ? 0 : 2, {
    ok: p.ok, visibility: want, target: { id: t.repo, owner: t.owner, repo: t.repo, root: t.root, host: t.host },
    detail: p.detail, did: p.did,
    ...(p.refused ? { refused: p.refused, remedy: p.remedy } : {}),
  });
}

/**
 * verbProjects — THE FLEET VIEW.
 * Usage: upper projects
 * The registry's projects + each one's live status row (from the aggregate).
 */
export async function verbProjects(root: string): Promise<VerbResult> {
  const { loadRegistry, projectToken } = await import("./projects");
  const { readStatus } = await import("./status");
  const reg = loadRegistry(root, process.env);
  const agg = readStatus(root) as { projects?: Record<string, unknown> } | null;
  const rows = reg.projects.map((p) => ({
    id: p.id, repo: `${p.owner}/${p.repo}`, root: p.root,
    armed: projectToken(p) ? "ARMED" : `DISARMED:no ${p.tokenEnv}`,
    status: agg?.projects?.[p.id] ?? null,
  }));
  return emit(0, { ok: true, legacy: reg.legacy, enrolled: rows.length, issues: reg.issues, projects: rows });
}

// MULTI-PROJECT: the verbs are VARIADIC (enroll takes 4-5 positionals), so the dispatcher
// type is the general form — a single optional `mode` could not express it.
// FIXED (the ship gate medium): a store-resolution refusal must be a SHAPED VerbResult for EVERY
// caller (a direct verb call, a test), not only the CLI. The map wraps each verb.
const rawVerbs: Record<string, (root: string, arg?: string, ...rest: string[]) => Promise<VerbResult>> = {
  status: verbStatus, plan: verbPlan, order: verbOrder, graph: verbGraph,
  gates: verbGates, sync: verbSync, bug: verbBug, desks: verbDesks, kick: verbKick,
  promote: verbPromote,
  enroll: verbEnroll, arm: verbArm, projects: verbProjects,
  attach: verbAttach, vis: verbVis,
};
export const VERBS: typeof rawVerbs = Object.fromEntries(
  Object.entries(rawVerbs).map(([k, fn]) => [k, async (root: string, arg?: string, ...rest: string[]): Promise<VerbResult> => {
    try { return await fn(root, arg, ...rest); }
    catch (e) {
      // FIXED (the whole-file scan HIGH): a StoreRefusal is a shaped exit 2; ANY OTHER throw
      // (a guardrail/render/query/sync/fetch throw) was rethrown as a bare VERB-THREW,
      // violating the file's own "one JSON object + exit 0/1/2" contract. All are shaped now
      // (a VerbResult-shaped negative verdict; the CLI never sees a bare stack).
      if (e instanceof StoreRefusal) return { code: 2, out: { ok: false, refused: e.message.slice(0, 240) } };
      console.error(JSON.stringify({ verb: k, error: String(e).slice(0, 200) }));
      return { code: 1, out: { ok: false, verdict: "VERB-THREW", verb: k, error: String(e).slice(0, 300) } };
    }
  }]),
);
