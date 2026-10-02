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
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, lstatSync, readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, isAbsolute, dirname, resolve } from "node:path";
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

const TOP_DIRS = ["gates", ".githooks"];
const WORKFLOW_FILES = ["gates.yml", "drift.yml"];

function copyTree(src: string, dst: string, copied: string[], backedUp: string[], skipped: string[], dry: boolean): void {
  if (!dry) mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src)) {
    const s = join(src, e), d = join(dst, e);
    if (e === "__pycache__") continue;                 // a build artifact, never source
    // FIXED (the whole-file scan HIGH): `statSync` FOLLOWS symlinks — a symlinked dir recursed
    // OUTSIDE the kernel (or looped). `lstatSync` does not; a symlink is SKIPPED, named.
    const st = lstatSync(s);
    if (st.isSymbolicLink()) { skipped.push(`${s} (symlink — not traversed)`); continue; }
    if (st.isDirectory()) { copyTree(s, d, copied, backedUp, skipped, dry); continue; }
    // FIXED (the audit HIGH H): a pre-existing DIFFERING file is backed up before the write —
    // the overwrite is destructive and was silent. A byte-identical file is a no-op (no spurious
    // .bak litter on a re-enroll).
    copyOne(s, d, copied, backedUp, skipped, dry);
  }
}

/** ONE file through the backup chokepoint: back up a differing existing target, then copy.
 *  FIXED (ship gate high): a directory-where-a-file-belongs (or an unreadable target) no longer
 *  THROWS out of enroll — the copy failure is caught and named; the caller sees it in `skipped`. */
function copyOne(src: string, d: string, copied: string[], backedUp: string[], skipped: string[], dry: boolean): void {
  // The backup detection runs in DRY-RUN too, so a preview sees which files WOULD be
  // overwritten (backedUp records the WOULD-BE path) — but the ACTUAL backup write is gated on
  // !dry (FIXED ship gate HIGH: dry-run littered .bak files despite "change nothing").
  // FIXED (round-4 HIGH): the DESTINATION could be a pre-created SYMLINK — existsSync/statSync/
  // copyFileSync all FOLLOW it, overwriting the link target (e.g. target/gates/x -> /etc/passwd).
  // lstatSync does not; a symlinked destination is SKIPPED, named.
  // FIXED (round-5 medium): `existsSync` FOLLOWS links and is FALSE for a DANGLING symlink, so
  // the guard was skipped and the later copyFileSync followed the link, writing the outside
  // target. lstat alone (ENOENT = not a symlink).
  try { if (lstatSync(d).isSymbolicLink()) { skipped.push(`${d} (destination symlink — not written)`); return; } }
  catch (e) { if ((e as { code?: string }).code !== "ENOENT") console.error(`enroll-dst-lstat:${d}:${String(e).slice(0, 40)}`); }
  if (existsSync(d)) {
    try {
      if (statSync(d).isFile() && !readFileSync(src).equals(readFileSync(d))) {
        const bak = `${d}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        if (!dry) copyFileSync(d, bak);
        backedUp.push(bak);
      }
    } catch (e) { console.error(`enroll-backup-skip:${d}:${String(e).slice(0, 60)}`); }
  }
  if (dry) { copied.push(d); return; }
  try { copyFileSync(src, d); copied.push(d); }
  // FIXED (ship gate HIGH): a COPY FAILURE was pushed to `copied` — enroll returned ok:true with
  // a failure counted as success. It lands in `skipped` now and forces ok:false (below).
  catch (e) { skipped.push(`${d} (COPY-FAILED:${String(e).slice(0, 40)})`); }
}

/** THE WIRING COPIER — extracted so `upper attach` REUSES it (the W3 rule: no second copier).
 *  Copies gates/ + .githooks/ + the workflows + the vendored package into the target. */
export function copyKernelSurface(opts: { kernel: string; target: string; id: string; dry?: boolean }):
  { copied: string[]; skipped: string[]; backedUp: string[]; missingRequired: string[]; inputError?: string } {
  const dry = opts.dry === true;
  // FIXED (the audit gate HIGH): this is a PUBLIC chokepoint now (`upper attach` calls it
  // directly), so it must validate its OWN inputs — `enroll()` used to be the only caller and
  // its checks do not protect a second one. An id with `..`/a slash, or a non-absolute target,
  // would write OUTSIDE the tree.
  const ID_OK = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
  // FIXED (the audit gate HIGH): `ID_OK.test` coerces, but `.includes` THROWS on undefined/null/
  // a number — so a non-string id crashed instead of returning the structured refusal.
  if (typeof opts.id !== "string" || !ID_OK.test(opts.id) || opts.id.includes("..")) {
    return { copied: [], skipped: [], backedUp: [], missingRequired: [], inputError: `COPY-INPUT-INVALID: bad id ${String(opts.id).slice(0, 40)}` };
  }
  if (typeof opts.kernel !== "string" || !isAbsolute(opts.kernel) || typeof opts.target !== "string" || !isAbsolute(opts.target)) {
    return { copied: [], skipped: [], backedUp: [], missingRequired: [], inputError: "COPY-INPUT-INVALID: non-absolute kernel/target" };
  }
  // FIXED (the audit gate MEDIUM): `enroll()` rejects overlap (kernel==target / nesting) — this
  // public chokepoint did not, so a direct caller could copy a tree into itself.
  const K = resolve(opts.kernel), T = resolve(opts.target);
  if (K === T || `${T}/`.startsWith(`${K}/`) || `${K}/`.startsWith(`${T}/`)) {
    return { copied: [], skipped: [], backedUp: [], missingRequired: [], inputError: `COPY-INPUT-INVALID: kernel and target overlap (${K})` };
  }
  const copied: string[] = [], skipped: string[] = [], backedUp: string[] = [];
  // 1. the host gates
  for (const d of TOP_DIRS) {
    const s = join(opts.kernel, d);
    if (!existsSync(s)) { skipped.push(`${d} (absent in the kernel tree)`); continue; }
    copyTree(s, join(opts.target, d), copied, backedUp, skipped, dry);
  }
  // 2. the workflows (the check-run producers)
  const wfSrc = join(opts.kernel, ".github", "workflows");
  if (existsSync(wfSrc)) {
    if (!dry) mkdirSync(join(opts.target, ".github", "workflows"), { recursive: true });
    for (const f of WORKFLOW_FILES) {
      const s = join(wfSrc, f);
      if (!existsSync(s)) { skipped.push(`.github/workflows/${f} (absent)`); continue; }
      copyOne(s, join(opts.target, ".github", "workflows", f), copied, backedUp, skipped, dry);
    }
  } else { skipped.push(".github/workflows (absent in the kernel tree)"); }
  // 3. the vendored build package
  const pkSrc = join(opts.kernel, "packages", "jarvis-upper-tier");
  const pkDst = join(opts.target, "packages", opts.id);
  if (existsSync(pkSrc)) {
    copyTree(pkSrc, pkDst, copied, backedUp, skipped, dry);
  } else { skipped.push("packages/ (absent — specs/spec-diff.ts will need a vendored SPEC)"); }
  // FIXED (the audit gate MEDIUM): the required-surface verdict is STRUCTURED (not a regex over
  // the human-readable `skipped` strings — a wording change in this file would have silently
  // disabled the caller's gate, the exact `\\.githooks` class).
  // FIXED (the audit gate MEDIUM): dir-existence alone lost the per-FILE gate — a kernel with a
  // workflow DIR but no gates.yml read as complete. The required FILES are checked too.
  const missingRequired: string[] = [];
  for (const d of TOP_DIRS) if (!existsSync(join(opts.kernel, d))) missingRequired.push(d);
  for (const f of WORKFLOW_FILES) {
    const p = join(opts.kernel, ".github", "workflows", f);
    // FIXED (the audit gate MEDIUM): existence-only let a DIRECTORY-where-a-file-belongs pass and
    // then throw inside the copier. The TYPE is checked.
    let isFile = false;
    try { isFile = existsSync(p) && statSync(p).isFile(); } catch (e) { console.error(`enroll-surface-stat:${p}:${String(e).slice(0, 40)}`); }
    if (!isFile) missingRequired.push(`.github/workflows/${f}${existsSync(p) ? " (not a file)" : ""}`);
  }
  return { copied, skipped, backedUp, missingRequired };
}

export function enroll(opts: EnrollOpts): EnrollResult {
  const dry = opts.dryRun === true;
  const copied: string[] = [], skipped: string[] = [], wrote: string[] = [], backedUp: string[] = [];

  // FIXED (the whole-file scan HIGH): `id`/`repo` were UNVALIDATED — `join(target,"packages",id)`
  // and `worktrees/${repo}` accepted `../`/`/`, writing OUTSIDE the target. Validated here.
  // FIXED (round-4 medium): typeof-guard + a LENGTH cap — `RegExp.test` coerces, but
  // `.includes("..")` THROWS on undefined/null/number, crashing enroll instead of refusing.
  const ID_OK = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
  // FIXED (round-5 medium): target/kernel typeof-guarded (isAbsolute throws on non-string).
  if (typeof opts.target !== "string" || !isAbsolute(opts.target) || !existsSync(opts.target)) return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-BAD-TARGET:${String(opts.target)} (must be an existing absolute path)` };
  if (typeof opts.kernel !== "string" || !isAbsolute(opts.kernel) || !existsSync(opts.kernel)) return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-BAD-KERNEL:${String(opts.kernel)}` };
  if (typeof opts.id !== "string" || !ID_OK.test(opts.id) || opts.id.includes("..")) return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-BAD-ID:${String(opts.id)} (letters/digits/._- only, ≤64, no ..)` };
  if (typeof opts.repo !== "string" || !ID_OK.test(opts.repo) || opts.repo.includes("..")) return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-BAD-REPO:${String(opts.repo)} (letters/digits/._- only, ≤64, no ..)` };
  if (typeof opts.owner !== "string" || !ID_OK.test(opts.owner)) return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-BAD-OWNER:${String(opts.owner)}` };
  // FIXED (round-5 low): tokenEnv was persisted unvalidated — projects.ts:checkProject (and thus
  // loadRegistry/projectToken) requires an ENV VAR NAME. Validate with the SAME rule here.
  const tokenEnv = opts.tokenEnv ?? "GH_TOKEN";
  if (typeof tokenEnv !== "string" || !/^[A-Z_][A-Z0-9_]*$/.test(tokenEnv)) return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-BAD-TOKEN-ENV:${String(tokenEnv)} (an ENV VAR NAME, never the bytes)` };
  // (the target/kernel typeof+path guards are ABOVE — the duplicate unguarded checks are removed)
  // FIXED (the whole-file scan medium): `join()===join()` missed trailing-slash/`./`/`../`
  // variants AND nesting (target inside kernel, or vice versa). resolve() normalizes; a
  // contains() check rejects nesting where an in-place copy would recurse or pollute.
  const K = resolve(opts.kernel), T = resolve(opts.target);
  if (K === T || `${T}/`.startsWith(`${K}/`) || `${K}/`.startsWith(`${T}/`)) {
    return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-SAME-TREE: kernel=${K} and target=${T} overlap` };
  }

  // FIXED (round-4 medium): the registry is READ + VALIDATED before ANY filesystem mutation, so
  // a corrupt-registry refusal leaves the target UNTOUCHED (enroll is not half-applied).
  const regPath = opts.registryFile ?? registryPath(opts.kernel);
  let reg: Registry = { projects: [] };
  if (existsSync(regPath)) {
    try { const r = JSON.parse(readFileSync(regPath, "utf8")); if (Array.isArray(r?.projects)) reg = r; }
    catch (e) {
      // FIXED (the whole-file scan HIGH): an UNPARSEABLE registry fell through to overwrite the
      // fleet file with a single entry. A NAMED refusal, BEFORE any copy.
      console.error(`enroll-registry-read-failed:${regPath}:${String(e).slice(0, 80)}`);
      return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-REGISTRY-CORRUPT:${regPath} (refusing to overwrite a fleet file that cannot be parsed)` };
    }
  }

  // 1-3. THE WIRING (the SAME copier `upper attach` uses — one implementation, W3)
  const surface = copyKernelSurface({ kernel: opts.kernel, target: opts.target, id: opts.id, dry });
  copied.push(...surface.copied); skipped.push(...surface.skipped); backedUp.push(...surface.backedUp);
  // FIXED (the audit gate MEDIUM): enroll() still regex-scanned `skipped` — the fragility just
  // removed from the attach path. It consumes the STRUCTURED fields now, the same way.
  if (surface.inputError) return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-BAD-INPUT: ${surface.inputError}` };

  // 4. the registry entry (idempotent: replaces a same-id entry, keeps the others)
  // (the registry was READ + VALIDATED at the top — before any copy)
  const spec: ProjectSpec = {
    id: opts.id, root: opts.target, owner: opts.owner, repo: opts.repo,
    tokenEnv,
    worktreeRoot: `${process.env.HOME ?? "/home/leviathan"}/.ao/data/worktrees/${opts.repo}`,
    store: join(opts.target, "runtime", opts.id, "store.sqlite"),
  };
  reg.projects = reg.projects.filter((p) => p.id !== opts.id).concat([spec]);
  // (the registry write is recorded AFTER a successful rename, below)
  // FIXED (the audit SLOP-14): this was the ONLY non-atomic state write in the tree — a
  // destructive read-modify-write of the operator's fleet file. A crash mid-write left a
  // TRUNCATED projects.json, which loadRegistry then reads as unparseable and falls back to the
  // legacy single project — the operator's whole fleet silently vanished. tmp + rename is
  // atomic (matching writeStatus/writeAggregate).
  if (!dry) {
    mkdirSync(dirname(regPath), { recursive: true });
    // FIXED (the ship gate LOW): a pid+time tmp name is predictable (a symlink target) and a
    // throw left .tmp litter. Random suffix + cleanup on failure.
    // FIXED (ship gate medium): Math.random() is predictable AND a bare writeFileSync follows a
    // pre-created symlink (overwriting the link target). crypto entropy + an EXCLUSIVE create.
    const tmp = `${regPath}.${process.pid}.${Date.now()}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(reg, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
      renameSync(tmp, regPath);
      // FIXED (round-5 medium): recorded ONLY after a SUCCESSFUL rename — a failed write no longer
      // reports the registry as written.
      wrote.push(regPath);
    } catch (e) {
      try { if (existsSync(tmp)) rmSync(tmp); } catch (err) { console.error(`enroll-tmp-cleanup-failed:${tmp}:${String(err).slice(0, 40)}`); }
      // FIXED (round-4 medium): a registry-write failure THREW instead of returning the
      // EnrollResult contract shape. Returned now.
      return { ok: false, copied, skipped, wrote, backedUp, reason: `ENROLL-REGISTRY-WRITE-FAILED:${String(e).slice(0, 80)}` };
    }
  }

  // FIXED (ship gate HIGH + the whole-file scan HIGH): a COPY-FAILED entry, OR a missing REQUIRED
  // artifact (gates/.githooks/the workflows), makes the enroll NOT ok — the ORDER LAW says a
  // missing workflow leaves the ruleset un-armable, yet enroll claimed success.
  const copyFailed = skipped.some((s) => s.includes("COPY-FAILED"));
  // FIXED (round-4 medium): the regex missed the generic ".github/workflows (absent in the
  // kernel tree)" skip and used an unescaped `.`. Both covered (the `\.` escapes the dot).
  // FIXED (round-5 HIGH): the file carried a DOUBLE backslash (`\\.githooks` = a literal
  // backslash + any char), so a missing `.githooks` never matched and enroll returned ok:true with
  // the ruleset un-armable. The single-escaped `\.githooks` matches the literal dot.
  // FIXED (the audit gate MEDIUM): enroll() consumed the STRUCTURED field, like the attach path.
  const missingRequired = surface.missingRequired.length > 0;
  const reason = copyFailed ? "ENROLL-COPY-FAILED" : missingRequired ? "ENROLL-MISSING-REQUIRED" : undefined;
  return { ok: !copyFailed && !missingRequired, copied, skipped, wrote, backedUp, ...(reason ? { reason } : {}) };
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
