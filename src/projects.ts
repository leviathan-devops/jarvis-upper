// projects.ts — THE MULTI-PROJECT REGISTRY.
//
// WHY A REGISTRY AND NOT MORE ENV VARS: the kernel was single-target by construction —
// `main.ts` read ONE UPPER_OWNER/UPPER_REPO/UPPER_WORKTREE_ROOT at module load, so a second
// project could only be served by a second daemon with its own unit. That does not scale and
// it cannot isolate failures (one unit = one crash domain). The registry makes N projects a
// first-class list, and the daemon runs their ticks CONCURRENTLY with settle-all isolation.
//
// THE SECRET LAW: a project entry carries a TOKEN ENV VAR NAME (`tokenEnv`), never the bytes.
// The credential resolves at call time from the environment. No secret is ever written to
// projects.json, a log, or a status file.
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, isAbsolute, posix } from "node:path";
import { isValidTickMs, MIN_TICK_MS } from "./limits";

export interface ProjectSpec {
  /** the stable project key — ALSO the AO project name the sync filters on. */
  id: string;
  /** the repo's absolute root (where gates/, .githooks/, .github/ live). */
  root: string;
  owner: string;
  repo: string;
  /** the NAME of the env var holding the credential (never the bytes). */
  tokenEnv: string;
  /** where the per-session git worktrees live (absolute). */
  worktreeRoot: string;
  /** the per-project SQLite path (absolute). One store per project — see below. */
  store: string;
  /** the per-project tick interval; falls back to UPPER_TICK_MS. */
  tickMs?: number;
  enabled?: boolean;
}

export interface Registry { projects: ProjectSpec[]; }

/** WHY ONE STORE PER PROJECT: SQLite has exactly ONE writer. N projects ticking every 15s
 *  against one file would contend (SQLITE_BUSY storms) and would share a crash domain: a
 *  corrupt store for project A would take project B down with it. Per-project stores give
 *  WRITE ISOLATION (no contention), FAILURE ISOLATION (A cannot break B), and make the
 *  `pr:<session>:<num>` id collision impossible (two projects may legitimately share a
 *  session name). The `project` column still exists in each store for the aggregate read. */

/** Normalize a store path for the isolation comparison: collapse `//`, drop a trailing slash,
 *  resolve `./` — so two spellings of ONE file cannot defeat `one store per project`. A realpath
 *  would resolve symlinks too, but the file need not exist yet (an enroll target). */
function normalizePath(p: string): string {
  // FIXED (ship gate medium): the hand-rolled collapse missed `..`, so `/a/b` and `/a/b/../b`
  // differed — defeating the one-store-per-project check. posix.normalize resolves `.`/`..`
  // WITHOUT requiring existence (unlike realpath), then a trailing slash is dropped.
  const n = posix.normalize(p).replace(/\/+$/, "");
  return n === "" ? "/" : n;
}

const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
const SEG_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

export function registryPath(root: string): string { return join(root, "projects.json"); }

export interface ProjectIssue { index: number; id: string; reason: string; }

export function projectStorePath(root: string, id: string): string {
  return join(root, "runtime", id, "store.sqlite");
}

/** The SYNTHESIZED single project from the legacy env vars — the backward-compatibility
 *  path. A daemon with no projects.json keeps behaving EXACTLY as before (zero regression). */
function legacyProject(root: string, env: Record<string, string | undefined>): ProjectSpec {
  const repo = env.UPPER_REPO || "jarvis-upper";
  const home = env.HOME || "/home/leviathan";
  return {
    id: repo,
    root,
    owner: env.UPPER_OWNER || "leviathan-devops",
    repo,
    tokenEnv: env.GH_TOKEN ? "GH_TOKEN" : "GITHUB_TOKEN",
    worktreeRoot: env.UPPER_WORKTREE_ROOT || `${home}/.ao/data/worktrees/${repo}`,
    store: env.UPPER_STORE || join(root, "store.sqlite"),
  };
}

function checkProject(p: unknown, index: number): { ok: true; spec: ProjectSpec } | { ok: false; issue: ProjectIssue } {
  const bad = (reason: string): { ok: false; issue: ProjectIssue } =>
    ({ ok: false, issue: { index, id: (p as ProjectSpec | null)?.id ?? "?", reason } });
  if (p === null || typeof p !== "object") return bad("entry is not an object");
  const s = p as Record<string, unknown>;
  if (typeof s.id !== "string" || !ID_RE.test(s.id)) return bad(`id must match ${ID_RE}`);
  if (typeof s.root !== "string" || !isAbsolute(s.root)) return bad("root must be an absolute path");
  if (!existsSync(s.root)) return bad(`root does not exist: ${s.root}`);
  try { if (!statSync(s.root).isDirectory()) return bad(`root is not a directory: ${s.root}`); }
  catch { return bad(`root is unreadable: ${s.root}`); }
  if (typeof s.owner !== "string" || !SEG_RE.test(s.owner)) return bad("owner is not a safe GitHub segment");
  if (typeof s.repo !== "string" || !SEG_RE.test(s.repo)) return bad("repo is not a safe GitHub segment");
  if (typeof s.tokenEnv !== "string" || !/^[A-Z_][A-Z0-9_]*$/.test(s.tokenEnv)) return bad("tokenEnv must be an ENV VAR NAME (never the bytes)");
  if (typeof s.worktreeRoot !== "string" || !isAbsolute(s.worktreeRoot)) return bad("worktreeRoot must be an absolute path");
  if (typeof s.store !== "string" || !isAbsolute(s.store)) return bad("store must be an absolute path");
  // FIXED (round-5 medium): the floor is the SHARED MIN_TICK_MS (was a hardcoded 1000 that could
  // drift from runtime.ts's parseTickMs / isValidTickMs).
  if (s.tickMs !== undefined && !isValidTickMs(s.tickMs)) return bad(`tickMs must be a number >= ${MIN_TICK_MS}`);
  return { ok: true, spec: {
    id: s.id, root: s.root as string, owner: s.owner as string, repo: s.repo as string,
    tokenEnv: s.tokenEnv, worktreeRoot: s.worktreeRoot as string, store: s.store as string,
    tickMs: s.tickMs as number | undefined, enabled: s.enabled !== false,
  } };
}

export interface LoadResult {
  projects: ProjectSpec[];
  issues: ProjectIssue[];
  /** true when the registry file was ABSENT and the legacy env project was synthesized. */
  legacy: boolean;
  /** true when a projects.json FILE EXISTS (even if it yielded the legacy fallback). Lets the
   *  CLI resolver distinguish "no registry deployed" from "a registry deployed but useless". */
  registryPresent: boolean;
  /** FIXED (ship gate medium): a STRUCTURED flag for "the registry EXISTS but is unusable"
   *  (unparseable / a missing `projects` array). The resolver keys on THIS, never a regex on
   *  the human-readable issue text (renaming a message silently disabled the guard). */
  registryBroken: boolean;
}

/** Load + validate the registry. NEVER throws: a bad entry is an ISSUE (named, skipped),
 *  a bad FILE falls back to the legacy project. One malformed project must not stop the
 *  other N — that is the whole point of the multi-project requirement. */
export function loadRegistry(root: string, env: Record<string, string | undefined> = process.env): LoadResult {
  const p = registryPath(root);
  const PRESENT = { registryPresent: true } as const;   // a file EXISTS from here on
  if (!existsSync(p)) return { projects: [legacyProject(root, env)], issues: [], legacy: true, registryBroken: false, registryPresent: false };
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(p, "utf8")); }
  catch (e) {
    // W-13: a multi-line catch with no log. An UNPARSEABLE registry silently falling back to
    // the legacy project would look like "one project" when the operator deployed a fleet —
    // the fallback must be LOUD, not merely named in the returned issues.
    console.error(`registry-unparseable:${p}:${String(e).slice(0, 80)} — fell back to the legacy env project`);
    return { projects: [legacyProject(root, env)], issues: [{ index: -1, id: "registry", reason: `projects.json is unparseable (${String(e).slice(0, 80)}) — fell back to the legacy env project` }], legacy: true, registryBroken: true, ...PRESENT };
  }
  const list = (raw && typeof raw === "object" && Array.isArray((raw as Registry).projects)) ? (raw as Registry).projects : null;
  if (list === null) {
    return { projects: [legacyProject(root, env)], issues: [{ index: -1, id: "registry", reason: "projects.json has no `projects` array — fell back to the legacy env project" }], legacy: true, registryBroken: true, ...PRESENT };
  }
  const projects: ProjectSpec[] = [];
  const issues: ProjectIssue[] = [];
  const seen = new Set<string>();
  const seenStores = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const r = checkProject(list[i], i);
    if (!r.ok) { issues.push(r.issue); continue; }
    // FIXED (the ship gate medium ×2): (a) the store key is NORMALIZED (resolved, trailing slash
    // stripped) so `/a/./b` and `/a/b` cannot bypass the isolation; (b) a DISABLED entry no longer
    // reserves its store nor falsely flags an enabled sibling — the disabled skip runs FIRST.
    if (r.spec.enabled === false) { issues.push({ index: i, id: r.spec.id, reason: "disabled (enabled:false) — skipped" }); continue; }
    if (seen.has(r.spec.id)) { issues.push({ index: i, id: r.spec.id, reason: "DUPLICATE id — the later entry is skipped" }); continue; }
    // FIXED (the audit HIGH E — "one store per project" was a CONVENTION, not an invariant):
    // the live store held TWO projects' rows. The isolation the layer's own doc comment claims
    // is now ENFORCED: two entries may not point at one store (SQLite has one writer; a shared
    // file is a shared crash domain and a shared write lock).
    const storeKey = normalizePath(r.spec.store);
    if (seenStores.has(storeKey)) {
      issues.push({ index: i, id: r.spec.id, reason: `DUPLICATE store — ${r.spec.store} is already claimed by another project (one store per project)` });
      continue;
    }
    seen.add(r.spec.id); seenStores.add(storeKey);
    projects.push(r.spec);
  }
  if (projects.length === 0) {
    return { projects: [legacyProject(root, env)], issues: [...issues, { index: -1, id: "registry", reason: "no VALID enabled project — fell back to the legacy env project" }], legacy: true, registryBroken: false, ...PRESENT };
  }
  return { projects, issues, legacy: false, registryBroken: false, registryPresent: true };
}

/** Resolve the store a CLI VERB must open. FLEET-CORRECT (the audit §3-D): with a registry the
 *  verb opens the PROJECT's own store — never the root's. Before this, every verb called
 *  `openStore()` with no argument, so `upper gates` read an empty store and `upper kick` /
 *  `upper promote` WROTE a store the daemon never read (the operator's readiness decision
 *  landed nowhere). A `--project <id>` names one explicitly; with exactly ONE project the id is
 *  optional (the legacy/one-project case — zero regression); with MANY it is REQUIRED, because
 *  an unnamed fleet read is AMBIGUOUS and ambiguity is a NAMED REFUSAL, never a silent
 *  root-store fallback. */
export function resolveStorePath(root: string, env: Record<string, string | undefined> = process.env, projectId?: string): string {
  const id = projectId ?? env.UPPER_PROJECT;
  const reg = loadRegistry(root, env);
  // FIXED (the ship gate HIGH): loadRegistry falls back to the LEGACY single project on an
  // UNPARSEABLE registry — so the resolver returned the ROOT store instead of refusing, masking
  // a fleet misconfiguration as a healthy single-project read/write to the WRONG file. A
  // registry that EXISTS but cannot be read is a NAMED REFUSAL, never a silent fallback.
  // (legacy:true with NO issues is the legitimate "no registry file at all" case.)
  // NARROWED (ship gate medium): only an UNPARSEABLE file / a MISSING array is BREAKING. A
  // registry that is valid-but-empty, or whose entries are all invalid/disabled, is a
  // LEGITIMATE legacy fallback (the documented never-throws behavior) — not a broker error.
  if (reg.registryBroken) {
    throw new Error(`REGISTRY-BROKEN: ${reg.issues.map((i) => i.reason).join("; ").slice(0, 200)}`);
  }
  // FIXED (the whole-file scan HIGH): a registry FILE that EXISTS but yields the LEGACY fallback
  // (all entries invalid/disabled) must NOT silently resolve the root store — the operator
  // deployed a registry and the daemon ticks something else. A NAMED refusal; a genuinely ABSENT
  // registry (registryPresent:false) still resolves the legacy store (zero regression).
  if (reg.registryPresent && reg.legacy) {
    throw new Error(`REGISTRY-EMPTY: projects.json exists but yields no valid project (${reg.issues.map((i) => i.reason).join("; ").slice(0, 160)}) — refusing to read the root store`);
  }
  if (id) {
    const p = reg.projects.find((x) => x.id === id);
    if (!p) throw new Error(`NO-PROJECT:${id} (known: ${reg.projects.map((x) => x.id).join(",") || "none"})`);
    return p.store;
  }
  // FIXED (round-4 medium): the registry-empty/broken refusal below is AFTER the explicit-id
  // branch, so an operator who names a project still gets a clear NO-PROJECT (not a generic
  // REGISTRY-EMPTY) — and a matching legacy id is not shadowed by the refusal.
  if (reg.projects.length === 1) return reg.projects[0].store;
  throw new Error(`AMBIGUOUS-STORE:${reg.projects.length}-projects-need---project <id> (${reg.projects.map((x) => x.id).join(",")})`);
}

/** Resolve a project's credential from its tokenEnv NAME. Never logs the bytes. */
export function projectToken(spec: ProjectSpec, env: Record<string, string | undefined> = process.env): string {
  return env[spec.tokenEnv] || "";
}
