// enroll.ts — PUT THE KERNEL ON A PROJECT.
//
// The five artifacts a project needs, and what each one enforces:
//   1. gates/                  — the host gates (spec-diff, shape_freeze, fence-check, ...)
//   2. .github/workflows/      — the 6 CI jobs whose NAMES become the required contexts
//   3. .githooks/              — the local layer (W-1..W-14), set via core.hooksPath
//   4. packages/<id>/<SPEC>    — the VENDORED build package the alignment gates read
//   5. the registry entry      — how the daemon FINDS the project
//
// THE ORDER LAW: the workflows must land and RUN once BEFORE the ruleset is armed, because the
// ruleset requires the OBSERVED check-run names — arming against a guessed name (or one that
// has never been posted) leaves the merge button dead with every check green.
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, isAbsolute, dirname } from "node:path";
import { registryPath, type ProjectSpec, type Registry } from "./projects";

export interface EnrollOpts {
  /** the source kernel tree (the one that already has gates/ + .githooks/ + the workflows). */
  kernel: string;
  /** the target project's absolute root. */
  target: string;
  /** the project id (the AO project name + the registry key). */
  id: string;
  owner: string;
  repo: string;
  /** the env var NAME holding the credential (never the bytes). */
  tokenEnv?: string;
  /** copy only (dry-run) — report what WOULD land, change nothing. */
  dryRun?: boolean;
  /** WHERE the registry entry lands. Defaults to the KERNEL's own projects.json; a caller may
   *  target another registry (a fleet hub, or a test's tmp dir — a test must never write the
   *  real registry). */
  registryFile?: string;
}

export interface EnrollResult {
  ok: boolean;
  copied: string[];
  skipped: string[];
  wrote: string[];
  reason?: string;
}

const TOP_DIRS = ["gates", ".githooks"];
const WORKFLOW_FILES = ["gates.yml", "drift.yml"];

function copyTree(src: string, dst: string, copied: string[], dry: boolean): void {
  if (!dry) mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src)) {
    const s = join(src, e), d = join(dst, e);
    if (e === "__pycache__") continue;                 // a build artifact, never source
    if (statSync(s).isDirectory()) { copyTree(s, d, copied, dry); continue; }
    if (!dry) copyFileSync(s, d);
    copied.push(d);
  }
}

export function enroll(opts: EnrollOpts): EnrollResult {
  const dry = opts.dryRun === true;
  const copied: string[] = [], skipped: string[] = [], wrote: string[] = [];

  if (!isAbsolute(opts.target) || !existsSync(opts.target)) return { ok: false, copied, skipped, wrote, reason: `ENROLL-BAD-TARGET:${opts.target} (must be an existing absolute path)` };
  if (!isAbsolute(opts.kernel) || !existsSync(opts.kernel)) return { ok: false, copied, skipped, wrote, reason: `ENROLL-BAD-KERNEL:${opts.kernel}` };
  if (join(opts.kernel) === join(opts.target)) return { ok: false, copied, skipped, wrote, reason: "ENROLL-SAME-TREE: the kernel and the target are the same tree" };

  // 1. the host gates
  for (const d of TOP_DIRS) {
    const s = join(opts.kernel, d);
    if (!existsSync(s)) { skipped.push(`${d} (absent in the kernel tree)`); continue; }
    copyTree(s, join(opts.target, d), copied, dry);
  }
  // 2. the workflows (the check-run producers)
  const wfSrc = join(opts.kernel, ".github", "workflows");
  if (existsSync(wfSrc)) {
    if (!dry) mkdirSync(join(opts.target, ".github", "workflows"), { recursive: true });
    for (const f of WORKFLOW_FILES) {
      const s = join(wfSrc, f);
      if (!existsSync(s)) { skipped.push(`.github/workflows/${f} (absent)`); continue; }
      if (!dry) copyFileSync(s, join(opts.target, ".github", "workflows", f));
      copied.push(join(opts.target, ".github", "workflows", f));
    }
  } else { skipped.push(".github/workflows (absent in the kernel tree)"); }
  // 3. the vendored build package (the alignment gates READ this path)
  const pkSrc = join(opts.kernel, "packages", "jarvis-upper-tier");
  const pkDst = join(opts.target, "packages", opts.id);
  if (existsSync(pkSrc)) {
    copyTree(pkSrc, pkDst, copied, dry);
    if (!dry) mkdirSync(pkDst, { recursive: true });
  } else { skipped.push("packages/ (absent — specs/spec-diff.ts will need a vendored SPEC)"); }

  // 4. the registry entry (idempotent: replaces a same-id entry, keeps the others)
  const regPath = opts.registryFile ?? registryPath(opts.kernel);
  let reg: Registry = { projects: [] };
  if (existsSync(regPath)) {
    try { const r = JSON.parse(readFileSync(regPath, "utf8")); if (Array.isArray(r?.projects)) reg = r; }
    // W-13: a catch must LOG or rethrow — an unreadable/unparseable registry would otherwise
    // silently REPLACE the operator's fleet with a single-entry file. It is named, and the
    // entry is still written (the caller sees the log).
    catch (e) { console.error(`enroll-registry-read-failed:${regPath}:${String(e).slice(0, 80)}`); }
  }
  const spec: ProjectSpec = {
    id: opts.id, root: opts.target, owner: opts.owner, repo: opts.repo,
    tokenEnv: opts.tokenEnv ?? "GH_TOKEN",
    worktreeRoot: `${process.env.HOME ?? "/home/leviathan"}/.ao/data/worktrees/${opts.repo}`,
    store: join(opts.target, "runtime", opts.id, "store.sqlite"),
  };
  reg.projects = reg.projects.filter((p) => p.id !== opts.id).concat([spec]);
  if (!dry) { mkdirSync(dirname(regPath), { recursive: true }); writeFileSync(regPath, JSON.stringify(reg, null, 2) + "\n", "utf8"); }
  wrote.push(regPath);

  return { ok: true, copied, skipped, wrote };
}

/** The ruleset payload for a project: the SAME 8 contexts as the kernel's own, with the two
 *  `factory/*` ones kept only when the daemon will actually publish to that repo. */
export function rulesetFor(opts: { factoryContexts: boolean }): Record<string, unknown> {
  const contexts = [
    "gates/anti-theatrical", "gates/issue-link", "gates/spec-gate",
    "gates/diff-budget", "gates/test", "gates/theatrical-verification",
    ...(opts.factoryContexts ? ["factory/fence2", "factory/verdict"] : []),
  ];
  return {
    name: "production-factory-gates",
    target: "branch",
    enforcement: "active",
    conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
    rules: [
      { type: "required_status_checks", parameters: { strict_required_status_checks_policy: true,
        required_status_checks: contexts.map((context) => ({ context })) } },
      { type: "pull_request", parameters: { required_approving_review_count: 1,
        dismiss_stale_reviews_on_push: true, require_last_push_approval: true,
        required_review_thread_resolution: true, require_code_owner_review: false } },
      { type: "non_fast_forward" },
      { type: "deletion" },
    ],
    bypass_actors: [],
  };
}
