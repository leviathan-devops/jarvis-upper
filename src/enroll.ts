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
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, isAbsolute, dirname } from "node:path";
import { registryPath, type ProjectSpec, type Registry } from "./projects";
import { GITHUB_JOB_CONTEXTS, STATUS_CONTEXTS } from "./status-contract";

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
  /** FIXED (the audit HIGH H): a pre-existing target file whose CONTENT DIFFERS from the
   *  kernel's was silently OVERWRITTEN (`copyFileSync`, no backup, no diff) — a foreign
   *  `.githooks/pre-commit` was destroyed and reported as a plain `copied`. Every such file is
   *  now backed up to `<path>.bak-<stamp>` and named here, so the destruction is visible. */
  backedUp: string[];
  reason?: string;
}

/** EnrollResult with the backup ledger — a caller may construct the legacy shape without it. */
export type EnrollResultFull = EnrollResult;

const TOP_DIRS = ["gates", ".githooks"];
const WORKFLOW_FILES = ["gates.yml", "drift.yml"];

function copyTree(src: string, dst: string, copied: string[], backedUp: string[], dry: boolean): void {
  if (!dry) mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src)) {
    const s = join(src, e), d = join(dst, e);
    if (e === "__pycache__") continue;                 // a build artifact, never source
    if (statSync(s).isDirectory()) { copyTree(s, d, copied, backedUp, dry); continue; }
    // FIXED (the audit HIGH H): a pre-existing DIFFERING file is backed up before the write —
    // the overwrite is destructive and was silent. A byte-identical file is a no-op (no spurious
    // .bak litter on a re-enroll).
    if (!dry && existsSync(d)) {
      try {
        const a = readFileSync(s), b = readFileSync(d);
        if (!a.equals(b)) {
          const bak = `${d}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
          copyFileSync(d, bak);
          backedUp.push(bak);
        }
      } catch (e) {
        // W-13: a catch must LOG or RETHROW. An unreadable existing target cannot be backed up,
        // but the write below still lands — the failure is NAMED, never swallowed.
        console.error(`enroll-backup-unreadable:${d}:${String(e).slice(0, 60)}`);
      }
    }
    if (!dry) copyFileSync(s, d);
    copied.push(d);
  }
}

export function enroll(opts: EnrollOpts): EnrollResult {
  const dry = opts.dryRun === true;
  const copied: string[] = [], skipped: string[] = [], wrote: string[] = [], backedUp: string[] = [];

  if (!isAbsolute(opts.target) || !existsSync(opts.target)) return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-BAD-TARGET:${opts.target} (must be an existing absolute path)` };
  if (!isAbsolute(opts.kernel) || !existsSync(opts.kernel)) return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-BAD-KERNEL:${opts.kernel}` };
  if (join(opts.kernel) === join(opts.target)) return { ok: false, copied, skipped, wrote, backedUp, reason: "ENROLL-SAME-TREE: the kernel and the target are the same tree" };

  // 1. the host gates
  for (const d of TOP_DIRS) {
    const s = join(opts.kernel, d);
    if (!existsSync(s)) { skipped.push(`${d} (absent in the kernel tree)`); continue; }
    copyTree(s, join(opts.target, d), copied, backedUp, dry);
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
    copyTree(pkSrc, pkDst, copied, backedUp, dry);
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
  // FIXED (the audit SLOP-14): this was the ONLY non-atomic state write in the tree — a
  // destructive read-modify-write of the operator's fleet file. A crash mid-write left a
  // TRUNCATED projects.json, which loadRegistry then reads as unparseable and falls back to the
  // legacy single project — the operator's whole fleet silently vanished. tmp + rename is
  // atomic (matching writeStatus/writeAggregate).
  if (!dry) {
    mkdirSync(dirname(regPath), { recursive: true });
    const tmp = `${regPath}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify(reg, null, 2) + "\n", "utf8");
    renameSync(tmp, regPath);
  }
  wrote.push(regPath);

  return { ok: true, copied, skipped, wrote, backedUp };
}

/** The ruleset payload for a project: the SAME 8 contexts as the kernel's own, with the two
 *  `factory/*` ones kept only when the daemon will actually publish to that repo. */
export function rulesetFor(opts: { factoryContexts: boolean }): Record<string, unknown> {
  // FIXED (the audit SLOP-07): these 8 strings were a THIRD copy of a contract declared FROZEN
  // — and this is the LIVE arm payload, the one that actually installs the ruleset. A drift here
  // requires a context nobody posts → the merge button dead with every check green. Derived now.
  const contexts = [...GITHUB_JOB_CONTEXTS, ...(opts.factoryContexts ? [STATUS_CONTEXTS.fence2, STATUS_CONTEXTS.verdict] : [])];
  return {
    name: "production-factory-gates",
    target: "branch",
    enforcement: "active",
    conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
    rules: [
      { type: "required_status_checks", parameters: { strict_required_status_checks_policy: true,
        required_status_checks: contexts.map((context) => ({ context })) } },
      // FIXED (MEASURED LIVE 2026-09-29 — the same unsolvable-by-construction gate that blocked
      // PR #2): a required approval "from someone other than the last pusher" with ONE
      // collaborator (who is also every PR's author) is a DEAD GATE — GitHub forbids
      // self-approval (`422 "Review Can not approve your own pull request"`), so the merge
      // button can never unlock. The SUBSTANTIVE enforcement is the required status checks
      // above (8 contexts, strict); the approval count is 0 so a solo operator can merge. A
      // repo with a second reviewer may raise it — but it must be a value its collaborator set
      // can actually satisfy.
      { type: "pull_request", parameters: { required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: true, require_last_push_approval: false,
        required_review_thread_resolution: true, require_code_owner_review: false } },
      { type: "non_fast_forward" },
      { type: "deletion" },
    ],
    bypass_actors: [],
  };
}
