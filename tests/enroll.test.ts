// enroll.test.ts — THE ENROLLMENT PROOF: put the kernel on a project, mechanically.
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enroll, rulesetFor } from "../src/enroll";
import { loadRegistry, registryPath } from "../src/projects";

// THE TEST SEAM: enrollment must NEVER write the kernel's REAL projects.json. Every test here
// targets a tmp registry; the fleet's own file is written by the operator's `upper enroll`.
const TMPREG = `${mkdtempSync(join(tmpdir(), "reg-"))}/projects.json`;

const KERNEL = join(import.meta.dir, "..");

function scratchProject(id: string): string {
  const d = mkdtempSync(join(tmpdir(), `enroll-${id}-`));
  // a minimal git-shaped project: a .git marker + a source dir
  mkdirSync(join(d, ".git"), { recursive: true });
  mkdirSync(join(d, "src"), { recursive: true });
  writeFileSync(join(d, "src", "index.ts"), "export const x = 1;\n");
  return d;
}

test("test_enroll_drops_the_full_enforcement_surface", () => {
  const proj = scratchProject("acme");
  const r = enroll({ kernel: KERNEL, target: proj, id: "acme", owner: "acme-org", repo: "acme-repo", registryFile: TMPREG });
  expect(r.ok).toBe(true);
  // the five artifacts
  expect(existsSync(join(proj, "gates", "does_anything_run.sh"))).toBe(true);
  expect(existsSync(join(proj, "gates", "fence-check.py"))).toBe(true);
  expect(existsSync(join(proj, "gates", "shape_freeze.sh"))).toBe(true);
  expect(existsSync(join(proj, ".githooks", "pre-commit"))).toBe(true);
  expect(existsSync(join(proj, ".githooks", "pre-push"))).toBe(true);
  expect(existsSync(join(proj, ".github", "workflows", "gates.yml"))).toBe(true);
  expect(existsSync(join(proj, ".github", "workflows", "drift.yml"))).toBe(true);
  // __pycache__ must NEVER be copied (a build artifact, not source)
  expect(existsSync(join(proj, "gates", "__pycache__"))).toBe(false);
});

test("test_enroll_writes_a_valid_registry_entry_the_daemon_can_load", () => {
  // the kernel's registry BEFORE (it exists in the live multi-project state) — the seam must
  // leave it byte-identical.
  const KERNEL_REG_BEFORE = existsSync(registryPath(KERNEL)) ? readFileSync(registryPath(KERNEL), "utf8") : "";
  const proj = scratchProject("beta");
  const r = enroll({ kernel: KERNEL, target: proj, id: "beta", owner: "beta-org", repo: "beta-repo", tokenEnv: "BETA_TOKEN", registryFile: TMPREG });
  expect(r.ok).toBe(true);
  expect(existsSync(TMPREG)).toBe(true);
  // FIXED (the live-registry mess): the kernel now HAS a registry (2 live projects), so
  // "absent" is the wrong assertion. The INTENT — the test seam does not touch it — is proven
  // by UNCHANGED: the bytes before == the bytes after.
  expect(readFileSync(registryPath(KERNEL), "utf8")).toBe(KERNEL_REG_BEFORE);
  const reg = { projects: JSON.parse(readFileSync(TMPREG, "utf8")).projects as { id: string; owner: string; repo: string; tokenEnv: string; root: string }[] };
  const found = reg.projects.find((p) => p.id === "beta");
  expect(found).toBeDefined();
  expect(found!.owner).toBe("beta-org");
  expect(found!.repo).toBe("beta-repo");
  expect(found!.tokenEnv).toBe("BETA_TOKEN");       // the NAME, never the bytes
  expect(found!.root).toBe(proj);
});

test("test_enroll_is_idempotent_and_never_duplicates_the_id", () => {
  const proj = scratchProject("gamma");
  enroll({ kernel: KERNEL, target: proj, id: "gamma", owner: "g", repo: "gamma", registryFile: TMPREG });
  enroll({ kernel: KERNEL, target: proj, id: "gamma", owner: "g", repo: "gamma", registryFile: TMPREG });
  const reg = JSON.parse(readFileSync(TMPREG, "utf8"));
  expect(reg.projects.filter((p: { id: string }) => p.id === "gamma").length).toBe(1);   // ONE entry
});

test("test_enroll_dry_run_changes_nothing", () => {
  const proj = scratchProject("delta");
  const before = JSON.parse(readFileSync(TMPREG, "utf8")).projects.length;
  const r = enroll({ kernel: KERNEL, target: proj, id: "delta", owner: "d", repo: "delta", dryRun: true, registryFile: TMPREG });
  expect(r.ok).toBe(true);
  expect(r.copied.length).toBeGreaterThan(0);        // it REPORTS what would land
  expect(existsSync(join(proj, "gates"))).toBe(false);   // ...and writes nothing
  expect(JSON.parse(readFileSync(TMPREG, "utf8")).projects.length).toBe(before);
});

test("test_ruleset_factory_contexts_are_optional", () => {
  const withF = rulesetFor({ factoryContexts: true });
  const withoutF = rulesetFor({ factoryContexts: false });
  const ctx = (r: Record<string, unknown>) =>
    ((r.rules as { type: string; parameters?: { required_status_checks?: { context: string }[] } }[])
      .find((x) => x.type === "required_status_checks")?.parameters?.required_status_checks ?? []).map((c) => c.context);
  expect(ctx(withF).length).toBe(8);
  expect(ctx(withoutF).length).toBe(6);
  expect(ctx(withoutF).some((c) => c.startsWith("factory/"))).toBe(false);
  // the unbypassable anchor is present in BOTH forms
  expect((withF as { bypass_actors: unknown[] }).bypass_actors).toEqual([]);
  expect((withoutF as { bypass_actors: unknown[] }).bypass_actors).toEqual([]);
});
