// attach-guards.ts — THE FIVE REAL GUARDS behind attach.ts's seam (W3).
//
// Each guard kills a MEASURED defect class from reports/Git_Onboarding_Unification_ShowMe.md:
//   checkRepo      → B5: the ruleset 403 discovered at ARM time, after the whole enroll.
//   checkRemote    → B0/B1: the tree whose origin does not name the registered target.
//   inspectHooks   → B3: `core.hooksPath` → a MISSING directory = silently INERT hooks.
//   inspectRegistry→ B6: `enroll` writing projects.json FRESH and dropping the legacy project.
//   inspectWiring  → B4: the enroll skipped entirely (SPEC.md present, gates/ absent).
//
// THE RULE (spec §2.2): every refusal is a NAMED token + the EXACT one command that fixes it.
// A remedy-less refusal is a defect. A silent fallback is a defect.
import { existsSync, readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, statSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { parseRemote } from "./target-guard";
import { registryPath, legacyProject, type Registry, type ProjectSpec } from "./projects";
import { copyKernelSurface } from "./enroll";
import type { AttachDeps, AttachTarget, RepoVerdict, WiringReport, OriginRead } from "./attach";

const UPPER_ENV = process.env.UPPER_HOST ?? "github.com";

/** The git-remote read, discriminated (mirrors target-guard's discipline: a failed read is
 *  NEVER silently "no remote"). */
// FIXED (the audit gate HIGH ×2, THE CHOKEPOINT): a spawn failure/EACCES/ENOTDIR used to ESCAPE
// from here, and every caller (the plan's derive, checkRemote) inherited the throw. The helper
// itself is now throw-proof, so EVERY caller is safe by construction — no call-site guards needed.
function readOrigin(root: string): { url: string | null; isRepo: boolean } {
  try {
    const inside = Bun.spawnSync(["git", "-C", root, "rev-parse", "--is-inside-work-tree"], { stderr: "pipe", stdout: "pipe" });
    if (inside.exitCode !== 0 || inside.stdout?.toString().trim() !== "true") return { url: null, isRepo: false };
    const u = Bun.spawnSync(["git", "-C", root, "remote", "get-url", "origin"], { stderr: "pipe", stdout: "pipe" });
    if (u.exitCode !== 0) return { url: null, isRepo: true };
    return { url: (u.stdout?.toString().trim() || "") || null, isRepo: true };
  } catch (e) {
    console.error(`attach-read-origin-failed:${root}:${String(e).slice(0, 60)}`);
    return { url: null, isRepo: false };
  }
}

/** Read `core.hooksPath` (empty when unset). */
function readHooksPath(root: string): string {
  // FIXED (the audit gate HIGH): throw-proof — a spawn failure returns "" (the UNSET shape), which
  // the caller treats as "the attach will set it", never as a crash.
  try {
    const r = Bun.spawnSync(["git", "-C", root, "config", "core.hooksPath"], { stderr: "pipe", stdout: "pipe" });
    return r.exitCode === 0 ? (r.stdout?.toString().trim() || "") : "";
  } catch (e) {
    console.error(`attach-read-hookspath-failed:${root}:${String(e).slice(0, 60)}`);
    return "";
  }
}

/** FIXED (the runtime seat's finding, H6): path comparison must be NORMALIZED. The CLI's kernel
 *  root carries a TRAILING SLASH (`…/jarvis-upper/`) while the registry's entry does not — a raw
 *  `===` therefore always failed, and a non-dry attach would write a DUPLICATE legacy row. */
export const normRoot = (p: string): string => { const t = p.replace(/\/+$/, ""); return t === "" ? "/" : t; };

/** THE REGISTRY MERGE (pure — the guard's inspect and apply share it). Adds/updates the spec by
 *  id, PRESERVES every existing project, and SEEDS the env-legacy project when the file is new
 *  or when no entry points at the kernel's own root (the B6 kill). */
export function mergeRegistry(reg: Registry, spec: ProjectSpec, kernel: string, env: Record<string, string | undefined>): Registry {
  const projects = reg.projects.filter((p) => p.id !== spec.id);
  // THE LEGACY PRESERVATION: the kernel's own tree must always stay registered. When the registry
  // is new (or its entries do not cover the kernel), the env-legacy project is seeded so the
  // daemon never silently drops the project it has been serving.
  const kernelLegacy = legacyProject(kernel, env);
  const covered = projects.some((p) => normRoot(p.root) === normRoot(kernelLegacy.root));
  if (!covered && normRoot(spec.root) !== normRoot(kernelLegacy.root)) projects.unshift(kernelLegacy);
  projects.push(spec);
  return { projects };
}

/** THE ATOMIC REGISTRY WRITE (tmp + rename + a re-parse assert). */
function writeRegistryAtomic(path: string, reg: Registry): { ok: boolean; reason?: string } {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.${Date.now()}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify(reg, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
      renameSync(tmp, path);
    } catch (e) {
      try { if (existsSync(tmp)) rmSync(tmp); } catch (err) { console.error(`attach-registry-tmp-cleanup:${String(err).slice(0, 40)}`); }
      throw e;
    }
    const back = JSON.parse(readFileSync(path, "utf8")) as Registry;
    // FIXED (the audit gate MEDIUM): the assert was LENGTH-only — a same-length corruption
    // (truncated entries, swapped ids) passed. Assert IDENTITY: every merged id must be present.
    if (!Array.isArray(back.projects) || back.projects.length !== reg.projects.length) {
      return { ok: false, reason: `ATTACH-REGISTRY-ASSERT:${path} (the re-parse lost entries: ${back.projects?.length ?? 0} != ${reg.projects.length})` };
    }
    // FIXED (the audit gate MEDIUM): id-presence alone let a same-length corruption (truncated
    // fields) pass. Compare the FULL entries.
    // FIXED (the audit gate MEDIUM): the tuple dropped the OPTIONAL fields (tickMs/enabled) and
    // `.sort()` without a comparator sorted by STRING coercion while the message claimed
    // byte-faithfulness. Every field, a real comparator.
    const canon = (list: ProjectSpec[]): string => JSON.stringify(
      list
        .map((x) => ({ id: x.id, root: x.root, owner: x.owner, repo: x.repo, tokenEnv: x.tokenEnv, worktreeRoot: x.worktreeRoot, store: x.store, tickMs: x.tickMs ?? null, enabled: x.enabled ?? true }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
    if (canon(reg.projects) !== canon(back.projects as ProjectSpec[])) {
      return { ok: false, reason: `ATTACH-REGISTRY-ASSERT:${path} (the re-parse is not byte-faithful to the merge)` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `ATTACH-REGISTRY-WRITE-FAILED:${String(e).slice(0, 90)}` };
  }
}

// ── THE FACTORY ──────────────────────────────────────────────────────────────────────────────

/** THE REAL DEPS — `upper attach`'s guards, closed over the kernel root. The ONLY place these
 *  effects live; `attach.ts` never touches fs/network itself (its purity is by construction). */
export function realDeps(kernel: string, rawHost = UPPER_ENV): AttachDeps {
  const regPath = registryPath(kernel);
  // FIXED (the audit gate HIGH ×2 + LOW): ONE normalized host feeds BOTH the API base and the
  // remote-gate comparison. (Was: `hostNorm` for the API while checkRemote compared the RAW host —
  // `https://ghes.example.com/` built a correct URL and then always failed ATTACH-REMOTE-HOST.)
  const host = rawHost.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") || "github.com";
  const apiBase = host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`;

  /** THE SHARED HOOKS PREDICATE — ONE function used by BOTH the inspect and the apply's assert.
   *  FIXED (the audit gate HIGH): it was the object method `inspectHooks`, and the assert called
   *  `this.inspectHooks(o)` — a DESTRUCTURED or proxied deps object left `this` undefined and
   *  threw a TypeError MID-MUTATION (after the wiring was already copied). A closure, no `this`. */
  function inspectHooksImpl(o: AttachTarget): { ok: boolean; needed: boolean; refused?: string; remedy?: string; detail: string } {
    const hp = readHooksPath(o.root);
    const dir = join(o.root, ".githooks");
    if (hp === "") return { ok: true, needed: true, detail: "core.hooksPath is unset — the attach will set it to .githooks" };
    if (hp !== ".githooks") {
      return { ok: false, needed: true, refused: "ATTACH-HOOKS-FOREIGN", remedy: `git -C ${JSON.stringify(o.root)} config core.hooksPath .githooks`, detail: `core.hooksPath=${hp} (a foreign hooks dir) — this tree's gate chain lives in .githooks` };
    }
    if (!existsSync(dir)) {
      return { ok: false, needed: true, refused: "ATTACH-HOOKS-INERT", remedy: `upper attach ${JSON.stringify(o.root)}   # re-run to lay the wiring, then the hooks activate`, detail: `core.hooksPath=.githooks but ${dir} is ABSENT — EVERY commit is ungated` };
    }
    // FIXED (the audit gate MEDIUM): the exec-bit gate checked ONLY pre-commit while applyHooks
    // chmods FOUR hooks — a non-executable pre-push passed the gate AND the assert. ALL are checked.
    // FIXED (the audit gate MEDIUM): an ABSENT non-pre-commit hook was silently tolerated while
    // the success detail claimed "all 4 executable" — a false statement. All four must be present.
    const HOOKS = ["pre-commit", "pre-push", "commit-msg", "prepare-commit-msg"];
    const missing: string[] = [];
    const nonExec: string[] = [];
    for (const f of HOOKS) {
      const fp = join(dir, f);
      if (!existsSync(fp)) { missing.push(f); continue; }
      try { if ((statSync(fp).mode & 0o111) === 0) nonExec.push(f); }
      catch (e) { console.error(`attach-hooks-stat:${String(e).slice(0, 40)}`); nonExec.push(`${f} (unreadable)`); }
    }
    if (missing.length > 0) {
      return { ok: false, needed: true, refused: "ATTACH-HOOKS-INCOMPLETE", remedy: `upper attach ${JSON.stringify(o.root)}   # re-run to lay the full chain`, detail: `absent hooks: ${missing.join(", ")}` };
    }
    if (nonExec.length > 0) {
      return { ok: false, needed: true, refused: "ATTACH-HOOKS-NOT-EXEC", remedy: `chmod +x ${JSON.stringify(dir)}/*`, detail: `not executable: ${nonExec.join(", ")} — git would skip them` };
    }
    return { ok: true, needed: false, detail: `hooksPath=.githooks · the dir exists · all ${HOOKS.length} hooks present + executable` };
  }

  return {
    /** STEP 1/2 — the origin probe (the SAME readOrigin the remote gate uses — ONE impl). */
    readOrigin(root: string): OriginRead {
      return readOrigin(root);
    },

    // ── STEP 4 · THE REPO GATE (B5: the 403 moves from arm-time to attach-time) ────────────────
    async checkRepo(o: AttachTarget, opts): Promise<RepoVerdict> {
      if (!opts.token) {
        return { ok: false, refused: "ATTACH-DISARMED", remedy: `printf '%s\\n' '${o.tokenEnv}=<the PAT>' >> ~/.config/jarvis-upper.env`, detail: `no credential for ${o.tokenEnv}` };
      }
      const hdrs = { Authorization: `Bearer ${opts.token}`, Accept: "application/vnd.github+json" };
      try {
        const res = await fetch(`${apiBase}/repos/${encodeURIComponent(o.owner)}/${encodeURIComponent(o.repo)}`, { headers: hdrs, signal: AbortSignal.timeout(10000) });
        if (res.status === 404) {
          return { ok: false, refused: `ATTACH-NO-REPO:${o.owner}/${o.repo}`, remedy: `gh repo create ${o.owner}/${o.repo} --public --source=${o.root} --remote=origin --push`, detail: "the GitHub repo does not exist" };
        }
        if (!res.ok) {
          return { ok: false, refused: `ATTACH-REPO-UNREADABLE:${res.status}`, remedy: `gh auth status   # the token must read ${o.owner}/${o.repo}`, detail: `HTTP ${res.status}` };
        }
        const repo = (await res.json()) as { private?: boolean; visibility?: string };
        const visibility = repo.visibility ?? (repo.private ? "private" : "public");
        if (visibility === "private") {
          // THE PLAN GATE: on a free plan a private repo CANNOT carry the ruleset (measured: 403
          // "Upgrade to GitHub Pro or make this repository public"). Refuse BEFORE any copy.
          let plan = "unknown";
          try {
            const u = await fetch(`${apiBase}/user`, { headers: hdrs, signal: AbortSignal.timeout(10000) });
            if (u.ok) plan = ((await u.json()) as { plan?: { name?: string } }).plan?.name ?? "unknown";
          } catch (e) { console.error(`attach-plan-probe:${String(e).slice(0, 50)}`); }
          // FIXED (the audit gate MEDIUM): the probe failing left plan="unknown" and the gate
          // PROCEEDED — a free-plan private repo with a transient auth/network error slid
          // through to the late 403 the B5 fix exists to move EARLIER. For a PRIVATE repo the
          // gate now FAILS CLOSED on an unresolved plan: the operator must know before the copy.
          if (plan === "free" || plan === "unknown") {
            return { ok: false, refused: plan === "free" ? "ATTACH-PRIVATE-FREE-REPO" : "ATTACH-PLAN-UNRESOLVED",
              remedy: `gh repo edit ${o.owner}/${o.repo} --visibility public   # or upgrade to Pro (the ruleset needs a public repo at plan=free); if the plan is Pro, re-run (the probe failed)`,
              detail: `PRIVATE + plan=${plan}` };
          }
        }
        return { ok: true, detail: `repo exists · visibility=${visibility}` };
      } catch (e) {
        return { ok: false, refused: `ATTACH-REPO-PROBE-FAILED`, remedy: `gh auth status`, detail: String(e).slice(0, 90) };
      }
    },

    // ── STEP 4 · THE REMOTE GATE (B0/B1) ───────────────────────────────────────────────────────
    checkRemote(o: AttachTarget) {
      const r = readOrigin(o.root);
      if (!r.isRepo) return { ok: false, refused: `ATTACH-NOT-A-REPO:${o.root}`, remedy: `git -C ${o.root} init -b main`, detail: "not a git work tree" };
      const url = r.url ?? "";
      const parsed = url ? parseRemote(url) : null;
      if (!parsed) {
        return { ok: false, refused: `ATTACH-REMOTE-MISSING`, remedy: `git -C ${o.root} remote add origin git@${host}:${o.owner}/${o.repo}.git`, detail: `origin is ${url || "(none)"} — it must name ${o.owner}/${o.repo}` };
      }
      if (parsed.owner !== o.owner || parsed.repo !== o.repo) {
        return { ok: false, refused: `ATTACH-REMOTE-MISMATCH:${parsed.owner}/${parsed.repo}`, remedy: `git -C ${o.root} remote set-url origin git@${host}:${o.owner}/${o.repo}.git`, detail: `origin names ${parsed.owner}/${parsed.repo}, the target is ${o.owner}/${o.repo}` };
      }
      if (parsed.host !== host) {
        return { ok: false, refused: `ATTACH-REMOTE-HOST:${parsed.host}`, remedy: `git -C ${o.root} remote set-url origin git@${host}:${o.owner}/${o.repo}.git`, detail: `origin's host is ${parsed.host}, expected ${host}` };
      }
      return { ok: true, detail: `origin matches ${o.owner}/${o.repo} on ${host}` };
    },

    // ── STEP 5 · THE WIRING (B4) ───────────────────────────────────────────────────────────────
    inspectWiring(o: AttachTarget) {
      const missing: string[] = [];
      for (const d of ["gates", ".githooks"]) if (!existsSync(join(o.root, d))) missing.push(d);
      if (!existsSync(join(o.root, ".github", "workflows", "gates.yml"))) missing.push(".github/workflows/gates.yml");
      return missing.length > 0
        ? { needed: true, detail: `would copy: ${missing.join(", ")}` }
        : { needed: false, detail: "the wiring is already present (gates/ + .githooks/ + workflows)" };
    },
    applyWiring(o: AttachTarget): WiringReport {
      // FIXED (the audit gate MEDIUM): `copyKernelSurface` is SYNCHRONOUS and can THROW
      // (readdirSync ENOTDIR when `gates` is a file, EACCES, a null-byte path) — the throw escaped
      // the shaped-refusal contract. Wrapped.
      let r: ReturnType<typeof copyKernelSurface>;
      try { r = copyKernelSurface({ kernel, target: o.root, id: o.id, dry: false }); }
      catch (e) {
        console.error(`attach-copy-threw:${o.root}:${String(e).slice(0, 60)}`);
        return { ok: false, refused: "ATTACH-COPY-FAILED", remedy: `ls -ld ${JSON.stringify(o.root)} ${JSON.stringify(kernel)}/gates   # a path may be the wrong TYPE or unreadable`, copied: [], skipped: [], backedUp: [], detail: `the copier threw: ${String(e).slice(0, 90)}` };
      }
      // FIXED (the audit gate MEDIUM): an INPUT error and a MISSING KERNEL SURFACE are different
      // faults — folding them into one refusal told the operator to inspect the kernel when the
      // actual fault was the id/path. Distinct channels, distinct remedies.
      if (r.inputError) {
        return { ok: false, refused: "ATTACH-BAD-INPUT", remedy: `upper attach <an absolute path> --id <a valid id>   # ${r.inputError}`, copied: [], skipped: [], backedUp: [], detail: r.inputError };
      }
      const failures = r.skipped.filter((s) => s.includes("COPY-FAILED"));
      // FIXED (the audit gate MEDIUM): the required-surface verdict was a REGEX over the
      // human-readable `skipped` strings — a wording change in enroll.ts silently disabled it
      // (history: the `\\.githooks` double-escape). The copier returns it STRUCTURED now.
      const missingRequired = r.missingRequired.length > 0;
      if (missingRequired) {
        return { ok: false, refused: "ATTACH-KERNEL-INCOMPLETE", remedy: `ls ${JSON.stringify(kernel)}/gates ${JSON.stringify(kernel)}/.githooks ${JSON.stringify(kernel)}/.github/workflows   # the kernel must carry all three`, copied: r.copied, skipped: r.skipped, backedUp: r.backedUp, detail: `the kernel is missing: ${r.missingRequired.join(", ")}` };
      }
      if (failures.length > 0) {
        return { ok: false, refused: "ATTACH-COPY-FAILED", remedy: `ls -ld ${o.root}/gates   # check the target is writable`, copied: r.copied, skipped: r.skipped, backedUp: r.backedUp, detail: failures.slice(0, 3).join("; ") };
      }
      return { ok: true, copied: r.copied, skipped: r.skipped, backedUp: r.backedUp, detail: `copied=${r.copied.length} skipped=${r.skipped.length} backedUp=${r.backedUp.length}` };
    },

    // ── STEP 6 · THE HOOKS GATE (B3 — the silent-inert kill; the closure above) ────────────────
    inspectHooks: inspectHooksImpl,
    applyHooks(o: AttachTarget) {
      const set = Bun.spawnSync(["git", "-C", o.root, "config", "core.hooksPath", ".githooks"], { stderr: "pipe", stdout: "pipe" });
      if (set.exitCode !== 0) {
        return { ok: false, refused: "ATTACH-HOOKS-SET-FAILED", remedy: `git -C ${o.root} config core.hooksPath .githooks`, detail: set.stderr?.toString().slice(0, 80) || `exit ${set.exitCode}` };
      }
      // chmod the hooks executable (a fresh copy may not carry the bit).
      const dir = join(o.root, ".githooks");
      try {
        for (const f of ["pre-commit", "pre-push", "commit-msg", "prepare-commit-msg"]) {
          const p = join(dir, f);
          if (existsSync(p)) chmodSync(p, 0o755);
        }
      } catch (e) { console.error(`attach-hooks-chmod:${String(e).slice(0, 50)}`); }
      // ASSERT — the apply and the inspect run the SAME predicate (no drift, NO `this`).
      const check = inspectHooksImpl(o);
      return check.ok ? { ok: true, detail: `set + asserted: ${check.detail}` } : { ok: false, refused: check.refused, remedy: check.remedy, detail: check.detail };
    },

    // ── STEP 7 · THE REGISTRY MERGE (B6 — the legacy-preservation kill) ─────────────────────────
    inspectRegistry(o: AttachTarget) {
      if (!existsSync(regPath)) {
        return { needed: true, detail: `no registry at ${regPath} — it would be CREATED with the env-legacy project + this one` };
      }
      try {
        const reg = JSON.parse(readFileSync(regPath, "utf8")) as Registry;
        if (!Array.isArray(reg?.projects)) {
          return { needed: true, refused: "ATTACH-REGISTRY-CORRUPT", remedy: `cp ${regPath} ${regPath}.bak && rm ${regPath}   # the daemon falls back to the legacy project`, detail: "the registry has no `projects` array" };
        }
        const has = reg.projects.some((p) => p.id === o.id);
        const legacy = legacyProject(kernel, process.env);
        const legacyCovered = reg.projects.some((p) => normRoot(p.root) === normRoot(legacy.root));
        if (!legacyCovered && normRoot(o.root) !== normRoot(legacy.root)) {
          return { needed: true, detail: `would add ${o.id} AND re-seed the legacy project ${legacy.id} (the registry does not cover the kernel's own tree)` };
        }
        return { needed: !has, detail: has ? `the entry ${o.id} is already present` : `would add ${o.id} (keeping all ${reg.projects.length} existing project(s))` };
      } catch (e) {
        return { needed: true, refused: "ATTACH-REGISTRY-CORRUPT", remedy: `cp ${regPath} ${regPath}.bak && rm ${regPath}`, detail: `unparseable: ${String(e).slice(0, 70)}` };
      }
    },
    applyRegistry(o: AttachTarget) {
      let reg: Registry = { projects: [] };
      if (existsSync(regPath)) {
        try {
          const parsed = JSON.parse(readFileSync(regPath, "utf8")) as Registry;
          // FIXED (the audit gate HIGH): a file WITHOUT a `projects` array stayed `{projects:[]}`
          // and was then atomically OVERWRITTEN — a SILENT FLEET RESET, while `inspectRegistry`
          // refused the same shape (plan and apply DIVERGED). They agree: refuse.
          if (!Array.isArray(parsed?.projects)) {
            return { ok: false, refused: "ATTACH-REGISTRY-CORRUPT", remedy: `cp ${JSON.stringify(regPath)} ${JSON.stringify(regPath)}.bak && rm ${JSON.stringify(regPath)}`, detail: "the registry has no `projects` array — refusing to overwrite a fleet file" };
          }
          reg = parsed;
        } catch (e) {
          return { ok: false, refused: "ATTACH-REGISTRY-CORRUPT", remedy: `cp ${regPath} ${regPath}.bak && rm ${regPath}`, detail: `unparseable: ${String(e).slice(0, 70)}` };
        }
      }
      const spec: ProjectSpec = {
        id: o.id, root: o.root, owner: o.owner, repo: o.repo, tokenEnv: o.tokenEnv,
        worktreeRoot: `${process.env.HOME ?? "/home/leviathan"}/.ao/data/worktrees/${o.repo}`,
        store: join(o.root, "runtime", o.id, "store.sqlite"),
      };
      const merged = mergeRegistry(reg, spec, kernel, process.env);
      const w = writeRegistryAtomic(regPath, merged);
      return w.ok
        ? { ok: true, detail: `merged → ${merged.projects.length} project(s): ${merged.projects.map((p) => p.id).join(", ")}` }
        : { ok: false, refused: w.reason ?? "ATTACH-REGISTRY-WRITE-FAILED", remedy: `ls -ld ${dirname(regPath)}   # the registry dir must be writable`, detail: w.reason ?? "" };
    },
  };
}
