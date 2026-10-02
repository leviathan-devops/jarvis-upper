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
import type { AttachDeps, AttachTarget, RepoVerdict, WiringReport } from "./attach";

const UPPER_ENV = process.env.UPPER_HOST ?? "github.com";

/** The git-remote read, discriminated (mirrors target-guard's discipline: a failed read is
 *  NEVER silently "no remote"). */
function readOrigin(root: string): { url: string | null; isRepo: boolean } {
  const inside = Bun.spawnSync(["git", "-C", root, "rev-parse", "--is-inside-work-tree"], { stderr: "pipe", stdout: "pipe" });
  if (inside.exitCode !== 0 || inside.stdout?.toString().trim() !== "true") return { url: null, isRepo: false };
  const u = Bun.spawnSync(["git", "-C", root, "remote", "get-url", "origin"], { stderr: "pipe", stdout: "pipe" });
  if (u.exitCode !== 0) return { url: null, isRepo: true };
  return { url: (u.stdout?.toString().trim() || "") || null, isRepo: true };
}

/** Read `core.hooksPath` (empty when unset). */
function readHooksPath(root: string): string {
  const r = Bun.spawnSync(["git", "-C", root, "config", "core.hooksPath"], { stderr: "pipe", stdout: "pipe" });
  return r.exitCode === 0 ? (r.stdout?.toString().trim() || "") : "";
}

/** FIXED (the runtime seat's finding, H6): path comparison must be NORMALIZED. The CLI's kernel
 *  root carries a TRAILING SLASH (`…/jarvis-upper/`) while the registry's entry does not — a raw
 *  `===` therefore always failed, and a non-dry attach would write a DUPLICATE legacy row. */
export const normRoot = (p: string): string => p.replace(/\/+$/, "");

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
    if (!Array.isArray(back.projects) || back.projects.length < reg.projects.length) {
      return { ok: false, reason: `ATTACH-REGISTRY-ASSERT:${path} (re-parse lost entries)` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `ATTACH-REGISTRY-WRITE-FAILED:${String(e).slice(0, 90)}` };
  }
}

// ── THE FACTORY ──────────────────────────────────────────────────────────────────────────────

/** THE REAL DEPS — `upper attach`'s guards, closed over the kernel root. The ONLY place these
 *  effects live; `attach.ts` never touches fs/network itself (its purity is by construction). */
export function realDeps(kernel: string, host = UPPER_ENV): AttachDeps {
  const regPath = registryPath(kernel);

  return {
    // ── STEP 3 · THE REPO GATE (B5: the 403 moves from arm-time to attach-time) ────────────────
    async checkRepo(o: AttachTarget, opts): Promise<RepoVerdict> {
      if (!opts.token) {
        return { ok: false, refused: "ATTACH-DISARMED", remedy: `printf '%s\\n' '${o.tokenEnv}=<the PAT>' >> ~/.config/jarvis-upper.env`, detail: `no credential for ${o.tokenEnv}` };
      }
      const hdrs = { Authorization: `Bearer ${opts.token}`, Accept: "application/vnd.github+json" };
      try {
        const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(o.owner)}/${encodeURIComponent(o.repo)}`, { headers: hdrs, signal: AbortSignal.timeout(10000) });
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
            const u = await fetch("https://api.github.com/user", { headers: hdrs, signal: AbortSignal.timeout(10000) });
            if (u.ok) plan = ((await u.json()) as { plan?: { name?: string } }).plan?.name ?? "unknown";
          } catch (e) { console.error(`attach-plan-probe:${String(e).slice(0, 50)}`); }
          if (plan === "free") {
            return { ok: false, refused: "ATTACH-PRIVATE-FREE-REPO", remedy: `gh repo edit ${o.owner}/${o.repo} --visibility public   # or upgrade to Pro (the ruleset is unavailable on private repos at plan=free)`, detail: `PRIVATE + plan=${plan}` };
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
      const r = copyKernelSurface({ kernel, target: o.root, id: o.id, dry: false });
      const failures = r.skipped.filter((s) => s.includes("COPY-FAILED"));
      const missingRequired = r.skipped.some((s) => /^(gates|\.githooks) \(absent|\.github\/workflows/.test(s));
      if (missingRequired) {
        return { ok: false, refused: "ATTACH-KERNEL-INCOMPLETE", remedy: `ls ${kernel}/gates ${kernel}/.githooks ${kernel}/.github/workflows   # the kernel must carry all three`, copied: r.copied, skipped: r.skipped, backedUp: r.backedUp, detail: `the kernel is missing a required surface` };
      }
      if (failures.length > 0) {
        return { ok: false, refused: "ATTACH-COPY-FAILED", remedy: `ls -ld ${o.root}/gates   # check the target is writable`, copied: r.copied, skipped: r.skipped, backedUp: r.backedUp, detail: failures.slice(0, 3).join("; ") };
      }
      return { ok: true, copied: r.copied, skipped: r.skipped, backedUp: r.backedUp, detail: `copied=${r.copied.length} skipped=${r.skipped.length} backedUp=${r.backedUp.length}` };
    },

    // ── STEP 6 · THE HOOKS GATE (B3 — the silent-inert kill) ───────────────────────────────────
    inspectHooks(o: AttachTarget) {
      const hp = readHooksPath(o.root);
      const dir = join(o.root, ".githooks");
      // UNSET = the NORMAL fresh-repo case. The attach SETS it — that is the job, not a refusal.
      // (FIXED BY RUNNING: refusing here made every fresh attach fail at step 6.)
      if (hp === "") {
        return { ok: true, needed: true, detail: "core.hooksPath is unset — the attach will set it to .githooks" };
      }
      // SET TO SOMETHING ELSE = a foreign hooks dir; setting ours would silently shadow theirs.
      if (hp !== ".githooks") {
        return { ok: false, needed: true, refused: "ATTACH-HOOKS-FOREIGN", remedy: `git -C ${o.root} config core.hooksPath .githooks`, detail: `core.hooksPath=${hp} (a foreign hooks dir) — this tree's gate chain lives in .githooks` };
      }
      // SET TO .githooks — now the dir MUST exist. THE B3 DEFECT, MEASURED LIVE: `hooksPath=.githooks`
      // with the dir ABSENT = git silently runs NOTHING (115 ungated commits on PLUTUS_VISION).
      if (!existsSync(dir)) {
        return { ok: false, needed: true, refused: "ATTACH-HOOKS-INERT", remedy: `upper attach ${o.root}   # re-run to lay the wiring, then the hooks activate`, detail: `core.hooksPath=.githooks but ${dir} is ABSENT — EVERY commit is ungated` };
      }
      const pre = join(dir, "pre-commit");
      if (!existsSync(pre)) {
        return { ok: false, needed: true, refused: "ATTACH-HOOKS-INCOMPLETE", remedy: `upper attach ${o.root}`, detail: `no .githooks/pre-commit in ${dir}` };
      }
      let exec = false;
      try { exec = (statSync(pre).mode & 0o111) !== 0; } catch (e) { console.error(`attach-hooks-stat:${String(e).slice(0, 40)}`); }
      if (!exec) {
        return { ok: false, needed: true, refused: "ATTACH-HOOKS-NOT-EXEC", remedy: `chmod +x ${dir}/*`, detail: `${pre} is not executable — git would skip it` };
      }
      return { ok: true, needed: false, detail: "hooksPath=.githooks · the dir exists · pre-commit is executable" };
    },
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
      // ASSERT — the apply and the inspect run the SAME predicate (no drift).
      const check = this.inspectHooks(o);
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
          if (Array.isArray(parsed?.projects)) reg = parsed;
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
