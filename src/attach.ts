// attach.ts — THE ONE-CLICK VERB'S ENGINE (the git-onboarding unification, W1).
//
// THE PROBLEM THIS SOLVES (measured live 2026-10-02 — reports/Git_Onboarding_Unification_ShowMe.md):
// the kernel was CORRECT at every point and the SEQUENCE was unowned. Seven manual acts (repo →
// gitignore → remote → SPEC → enroll → hooksPath → arm) let two live builds each skip a DIFFERENT
// one: `jev-fact-kernel` enrolled with no remote; `PLUTUS_VISION` carried `hooksPath=.githooks`
// while the directory was ABSENT (hooks silently INERT — 115 ungated commits). This module owns
// the sequence: ONE pure plan over 8 gated steps, ONE apply that mutates only after every gate
// passes, and EVERY refusal a named token + the exact remedy command.
//
// THE SEAM (the interface-first rule): the five effectful guards are INJECTED (`AttachDeps`), so
// this file compiles and is testable standalone; W3 supplies the real implementations
// (attach-guards.ts) and W2's verb wires them together. `attachPlan` is PURE — it computes the
// verdict of every step and MUTATES NOTHING (it is the `--dry` engine AND the test surface).

import { existsSync, statSync } from "node:fs";

// ── THE TYPES ────────────────────────────────────────────────────────────────────────────────

export interface AttachOpts {
  /** the project's absolute root (the tree to attach). */
  path: string;
  /** optional overrides; derived from the tree + the registry when omitted. */
  id?: string;
  owner?: string;
  repo?: string;
  tokenEnv?: string;
  /** the GitHub host (UPPER_HOST, default github.com). */
  host?: string;
  /** the credential for the repo gate — resolved by the caller from `tokenEnv`, never stored. */
  token?: string;
  // FIXED (the audit gate MEDIUM): `create/makePublic/arm/restart` were DECLARED but never read —
  // documented opt-ins that silently did nothing. They are also OPERATOR-OWNED actions (creating
  // a repo, flipping visibility) per the build's HARD STOPS: the correct shape is a NAMED
  // refusal + the exact remedy, never an auto-fix flag.
}

/** One of the 8 gated steps. `mutates` is true only for the steps that change the world. */
export interface AttachStep {
  /** 1..8, in execution order. */
  n: number;
  id: "preflight" | "derive" | "repo-gate" | "remote-gate" | "wiring" | "hooks-gate" | "registry" | "verify";
  ok: boolean;
  /** a NAMED refusal token (e.g. ATTACH-HOOKS-INERT) — present iff !ok. */
  refused?: string;
  /** the EXACT one command that fixes it — a refusal without a remedy is a defect (spec §2.2). */
  remedy?: string;
  /** what this step would change (a preview when dry, a report when applied). */
  detail: string;
  /** true iff applying this step writes to the tree/registry. */
  mutates: boolean;
}

/** The resolved identity of the thing being attached. */
export interface AttachTarget {
  id: string;
  owner: string;
  repo: string;
  tokenEnv: string;
  host: string;
  root: string;
}

/** The pure plan: every step's verdict, computed WITHOUT touching the world. */
export interface AttachPlan {
  target: AttachTarget;
  steps: AttachStep[];
  /** the first failing step's token, or undefined when every step would pass. */
  refused?: string;
  /** the remedy for `refused`. */
  remedy?: string;
  /** how many steps would mutate (0 on a fully-attached tree — the idempotence signal). */
  mutations: number;
}

/** The apply's report: the plan + what each step ACTUALLY did (the tool-result surface). */
export interface AttachResult extends AttachPlan {
  applied: boolean;
  report: string[];
}

// ── THE SEAM (W3 implements these; attachPlan/attachApply only call them) ────────────────────

/** The read-only origin probe — injectable so `attachPlan` owns NO process spawn (the audit's
 *  purity finding) and the tests never have to mock git binaries. */
export interface OriginRead { url: string | null; isRepo: boolean }
export interface RepoVerdict {
  ok: boolean;
  refused?: string;
  remedy?: string;
  detail: string;
}
export interface WiringReport {
  ok: boolean;
  refused?: string;
  remedy?: string;
  copied: string[];
  skipped: string[];
  backedUp: string[];
  detail: string;
}

/** The five effectful guards. `attachPlan` may call the READ-ONLY ones (checkRepo, checkRemote,
 *  inspectWiring) — applyWiring/applyHooks/applyRegistry are called ONLY by `attachApply`. */
export interface AttachDeps {
  /** STEP 1/2 — the read-only origin probe (the DI seam for the plan's purity). */
  readOrigin(root: string): OriginRead;
  /** STEP 3 — the repo exists + the account plan permits the ruleset (the B5 late-403 fix). */
  checkRepo(o: AttachTarget, opts: AttachOpts): Promise<RepoVerdict>;
  /** STEP 4 — the tree's `origin` parses to owner/repo (reuses target-guard's parseRemote). */
  checkRemote(o: AttachTarget): { ok: boolean; refused?: string; remedy?: string; detail: string };
  /** STEP 5 — READ-ONLY: would the wiring copy change anything? (the pure-plan probe). */
  inspectWiring(o: AttachTarget): { needed: boolean; detail: string };
  /** STEP 6 — READ-ONLY. THE THREE-PART PREDICATE (fixed by running): `needed` = the attach must
   *  still SET it (unset is the NORMAL fresh-repo case, never a refusal); `ok:false` is reserved
   *  for the INERT shapes — a set-but-absent dir (the B3 defect) or a foreign/non-exec hook. */
  inspectHooks(o: AttachTarget): { ok: boolean; needed: boolean; refused?: string; remedy?: string; detail: string };
  /** STEP 7 — READ-ONLY: would the registry merge drop a project or is it corrupt? (the B6 probe). */
  inspectRegistry(o: AttachTarget): { needed: boolean; refused?: string; remedy?: string; detail: string };

  /** STEP 5 — APPLY: copy the wiring (REUSES enroll.ts's copyTree/copyOne — no second copier). */
  applyWiring(o: AttachTarget): WiringReport;
  /** STEP 6 — APPLY: set `core.hooksPath=.githooks` AND ASSERT the dir + the executables. */
  applyHooks(o: AttachTarget): { ok: boolean; refused?: string; remedy?: string; detail: string };
  /** STEP 7 — APPLY: the merge-by-id + the legacy preservation + the atomic write + the re-parse. */
  applyRegistry(o: AttachTarget): { ok: boolean; refused?: string; remedy?: string; detail: string };
}

// ── THE 8-STEP TABLE (the single source of order; both plan and apply walk it) ───────────────

// THE ORDER (the contract — pinned by tests/attach_plan.test.ts): the LOCAL free checks precede
// the REMOTE ones (fixed by running: a tokenless env must still get the useful diagnosis).
const STEP_IDS: AttachStep["id"][] = ["preflight", "derive", "remote-gate", "repo-gate", "wiring", "hooks-gate", "registry", "verify"];

/** The path-derived default id (the last path segment, sanitized to the registry's id rule). */
export function deriveId(path: string): string {
  const seg = path.replace(/\/+$/, "").split("/").pop() ?? "";
  const clean = seg.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^[._-]+/, "").slice(0, 64);
  return clean || "project";
}

/** Parse `git remote get-url origin` from a tree (injectable for tests via the deps' checkRemote). */
export function deriveTarget(opts: AttachOpts, remote?: { owner: string; repo: string } | null): AttachTarget {
  return {
    id: opts.id ?? deriveId(opts.path),
    owner: opts.owner ?? remote?.owner ?? "",
    repo: opts.repo ?? remote?.repo ?? "",
    tokenEnv: opts.tokenEnv ?? "GH_TOKEN",
    host: opts.host ?? "github.com",
    root: opts.path,
  };
}

// ── THE PURE PLAN ────────────────────────────────────────────────────────────────────────────

/** Compute the 8 verdicts. PURE — it calls only the READ-ONLY deps and mutates nothing. */
export async function attachPlan(opts: AttachOpts, deps: AttachDeps): Promise<AttachPlan> {
  const steps: AttachStep[] = [];
  const push = (n: number, id: AttachStep["id"], ok: boolean, detail: string, mutates: boolean, refused?: string, remedy?: string) =>
    steps.push({ n, id, ok, detail, mutates, ...(refused ? { refused } : {}), ...(remedy ? { remedy } : {}) });

  // STEP 1 — PREFLIGHT: the path exists + is a DIRECTORY + is a work tree.
  // FIXED (W1's own test caught this — the runtime-ledger entry): `Bun.file(path).exists()` is
  // FALSE for a DIRECTORY (it is a file API), so the preflight refused EVERY valid tree with
  // ATTACH-NOT-A-PATH. A directory check must be a stat, not Bun.file.
  // FIXED (the audit gate HIGH): `existsSync && statSync(...)` still THREW on an ENOENT race,
  // EACCES, ENOTDIR or a symlink loop — escaping as ATTACH-THREW instead of a named refusal.
  let exists = false;
  try { exists = existsSync(opts.path) && statSync(opts.path).isDirectory(); }
  catch (e) { console.error(`attach-preflight-stat:${String(e).slice(0, 50)}`); exists = false; }
  if (!exists) {
    push(1, "preflight", false, `${opts.path} does not exist`, false, `ATTACH-NOT-A-PATH:${opts.path}`, `mkdir -p ${JSON.stringify(opts.path)} && git -C ${JSON.stringify(opts.path)} init -b main`);
    return finish(steps, deriveTarget(opts), opts);
  }
  // FIXED (the audit gate MEDIUM): the plan called Bun.spawnSync ITSELF — a purity violation (it
  // claimed "read-only deps only"), a DI break (tests had to mock git binaries) and a TOCTOU (the
  // derive snapshot could differ from the guard's). The probe is a DEP now.
  const probed = deps.readOrigin(opts.path);
  const isRepo = probed.isRepo;
  if (!isRepo) {
    // FIXED (the audit gate LOW): a REFUSED step claimed `mutates:true` — the dry output was
    // self-contradictory (the step said mutates, the plan's count said 0).
    push(1, "preflight", false, `${opts.path} is not a git work tree`, false, `ATTACH-NOT-A-REPO:${opts.path}`, `git -C ${JSON.stringify(opts.path)} init -b main && git -C ${JSON.stringify(opts.path)} add -A && git -C ${JSON.stringify(opts.path)} commit -m "chore: initial commit"`);
    return finish(steps, deriveTarget(opts), opts);
  }
  push(1, "preflight", true, `a git work tree at ${opts.path}`, false);

  // STEP 2 — DERIVE: the identity from the flags + the tree's origin.
  const originUrl = probed.url ?? "";
  const parsed = originUrl ? parseOrigin(originUrl) : null;
  const target = deriveTarget(opts, parsed);
  if (!target.owner || !target.repo) {
    push(2, "derive", false, `no owner/repo (origin="${originUrl || "(none)"}", no --owner/--repo given)`, false,
      `ATTACH-NO-TARGET`, `git -C ${opts.path} remote add origin git@${target.host}:<owner>/<repo>.git   # or pass --owner <o> --repo <r>`);
    return finish(steps, target, opts);
  }
  push(2, "derive", true, `${target.id} → ${target.owner}/${target.repo}`, false);

  // STEP 3 — REMOTE GATE (LOCAL, free). ORDER FIXED BY RUNNING: this ran AFTER the repo gate, so
  // a tokenless environment died at ATTACH-DISARMED before the free local check could name the
  // ACTUAL misconfiguration (a sibling origin, a missing remote). The cheap check goes first —
  // and it needs no credential, so the most common failure is diagnosable offline.
  const rem = deps.checkRemote(target);
  push(3, "remote-gate", rem.ok, rem.detail, false, rem.refused, rem.remedy);
  if (!rem.ok) return finish(steps, target, opts);

  // STEP 4 — REPO GATE (REMOTE, needs the token): the repo + the plan's ruleset eligibility
  // (the B5 late-403 fix).
  const repo = await deps.checkRepo(target, opts);
  push(4, "repo-gate", repo.ok, repo.detail, false, repo.refused, repo.remedy);
  if (!repo.ok) return finish(steps, target, opts);

  // STEP 5 — WIRING: what the copy would change.
  const wire = deps.inspectWiring(target);
  push(5, "wiring", true, wire.detail, wire.needed);

  // STEP 6 — HOOKS GATE: the B3 probe (set AND present AND executable).
  const hooks = deps.inspectHooks(target);
  push(6, "hooks-gate", hooks.ok, hooks.detail, hooks.needed, hooks.refused, hooks.remedy);
  if (!hooks.ok) return finish(steps, target, opts);

  // STEP 7 — REGISTRY: the merge would keep every project.
  const reg = deps.inspectRegistry(target);
  push(7, "registry", !reg.refused, reg.detail, reg.needed, reg.refused, reg.remedy);
  if (reg.refused) return finish(steps, target, opts);

  // STEP 8 — VERIFY: the summary + the next commands.
  push(8, "verify", true, `attach plan complete: ${steps.filter((s) => s.mutates).length} step(s) would change the world`, false);

  return finish(steps, target, opts);
}

// ── THE APPLY (the only mutator) ─────────────────────────────────────────────────────────────

/** Apply the plan. Every gate ALREADY passed (attachPlan is the precondition); a step's apply
 *  failure is a NAMED refusal and the apply STOPS — never a half-attached tree. */
export async function attachApply(plan: AttachPlan, opts: AttachOpts, deps: AttachDeps): Promise<AttachResult> {
  const report: string[] = [];
  if (plan.refused) {
    return { ...plan, applied: false, report: [`refused before apply: ${plan.refused}`] };
  }
  const t = plan.target;
  const needs = (id: AttachStep["id"]): boolean => plan.steps.find((s) => s.id === id)?.mutates === true;

  // IDEMPOTENCE (FR-7): a step the PLAN marked not-needed is NOT applied — a second attach on a
  // satisfied tree is a genuine noop, never a re-write dressed as work.
  // STEP 5 — the wiring (REUSES enroll.ts's copier via the deps).
  if (needs("wiring")) {
    const w = deps.applyWiring(t);
    report.push(`wiring: copied=${w.copied.length} skipped=${w.skipped.length} backedUp=${w.backedUp.length}`);
    if (!w.ok) {
      return { ...plan, applied: false, refused: w.refused, remedy: w.remedy, report: [...report, `WIRING FAILED: ${w.refused ?? "?"}`] };
    }
  } else { report.push("wiring: already present (noop)"); }

  // STEP 6 — the hooks (set + ASSERT — the B3 kill).
  if (needs("hooks-gate")) {
    const h = deps.applyHooks(t);
    report.push(`hooks: ${h.detail}`);
    if (!h.ok) {
      return { ...plan, applied: false, refused: h.refused, remedy: h.remedy, report: [...report, `HOOKS FAILED: ${h.refused ?? "?"}`] };
    }
  } else { report.push("hooks: already set + asserted (noop)"); }

  // STEP 7 — the registry (merge + preserve + atomic + re-parse — the B6 kill).
  if (needs("registry")) {
    const r = deps.applyRegistry(t);
    report.push(`registry: ${r.detail}`);
    if (!r.ok) {
      return { ...plan, applied: false, refused: r.refused, remedy: r.remedy, report: [...report, `REGISTRY FAILED: ${r.refused ?? "?"}`] };
    }
  } else { report.push("registry: already present (noop)"); }

  report.push(`NEXT: git -C ${t.root} push -u origin HEAD   ·   systemctl --user restart jarvis-upper   ·   bun src/cli.ts arm ${t.id}`);
  return { ...plan, applied: true, report };
}

// ── THE HELPERS ──────────────────────────────────────────────────────────────────────────────

/** The first failing step's token becomes the plan's refusal (the whole plan reports ONE cause). */
function finish(steps: AttachStep[], target: AttachTarget, _opts: AttachOpts): AttachPlan {
  const bad = steps.find((s) => !s.ok);
  return {
    target, steps,
    ...(bad ? { refused: bad.refused, remedy: bad.remedy } : {}),
    mutations: steps.filter((s) => s.mutates && s.ok).length,
  };
}

/** Parse a git origin (https / ssh / scp-like) into owner/repo. LOCAL COPY of the shape
 *  target-guard.ts's parseRemote validates — kept here so this module has ZERO imports and is
 *  testable standalone (the interface-first rule). W3's checkRemote uses the real target-guard. */
export function parseOrigin(url: string): { owner: string; repo: string; host: string } | null {
  const u = url.trim();
  if (!u) return null;
  let path: string | null = null;
  let host = "";
  const scp = u.match(/^[^@/\s]+@([^:/\s]+):(.+)$/);
  if (scp) { host = scp[1]; path = scp[2]; }
  else {
    try { const parsed = new URL(u); host = parsed.hostname; path = parsed.pathname; } catch { path = null; }
  }
  if (!path) return null;
  const parts = path.replace(/\/+$/, "").replace(/\.git$/i, "").split("/").map((x) => x.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  return { owner: parts[0], repo: parts[1], host };
}

/** The step-id list, exported for the tests' walk (the order IS the contract). */
export const ATTACH_STEP_ORDER = STEP_IDS;
