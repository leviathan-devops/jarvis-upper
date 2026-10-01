// target-scope.test.ts — THE ROOT-SCOPE REGRESSION PIN.
//
// THE BUG (measured live 2026-10-02): runtime.tick() passed `root` (the KERNEL's own root,
// opts.root) to the target guard instead of `project.root`. The guard therefore read THE
// KERNEL TREE's origin for EVERY project — so `jarvis-upper` passed by accident (its root IS
// the kernel root) while every other project was refused with the kernel's own URL named as the
// "mismatch". A multi-project fleet could never arm. This test pins the scope: each project's
// refusal must name ITS OWN origin, never another project's.
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRuntime } from "../src/runtime";
import { openStore } from "../src/store";
import type { ProjectSpec } from "../src/projects";

let base = "";
beforeEach(() => { base = mkdtempSync(join(tmpdir(), "tgt-")); });
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

/** a real git repo at <dir> with the given origin. */
function repoWithOrigin(dir: string, origin: string): string {
  mkdirSync(dir, { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: dir });
  Bun.spawnSync(["git", "-C", dir, "remote", "add", "origin", origin], { cwd: dir });
  return dir;
}

function specFor(root: string, id: string, owner: string, repo: string): ProjectSpec {
  return { id, root, owner, repo, tokenEnv: "GH_TOKEN", worktreeRoot: `${root}/.wt`, store: join(root, "s.sqlite") };
}

const deps = () => ({
  probe: async () => true, listPrs: async () => [],
  rails: async () => ({ frames: 0, bytes: 0, lastSeq: 0 }),
});

test("the target guard reads EACH project's OWN root — not the kernel's, not a sibling's", async () => {
  // two trees, two DIFFERENT origins — the exact live shape (the kernel + a build tree)
  const kernel = repoWithOrigin(join(base, "kernel"), "https://github.com/acme/kernel.git");
  const build = repoWithOrigin(join(base, "build"), "https://github.com/acme/build.git");

  const rKernel = createRuntime({ root: kernel, project: specFor(kernel, "kernel", "acme", "kernel"), db: openStore(":memory:"), deps: deps() });
  const rBuild = createRuntime({ root: kernel, project: specFor(build, "build", "acme", "build"), db: openStore(":memory:"), deps: deps() });

  const sKernel = await rKernel.tick();
  const sBuild = await rBuild.tick();

  // BOTH must pass: each guard read its OWN project's origin (acme/kernel, acme/build)
  expect(sKernel.reachable).not.toBe(false);
  expect(sBuild.reachable).not.toBe(false);   // ← the bug: this was `false`, naming kernel's URL
  expect(sBuild.errors).toEqual([]);
});

test("a project whose origin is a SIBLING's is refused, naming ITS OWN origin", async () => {
  const other = repoWithOrigin(join(base, "other"), "https://github.com/acme/other.git");
  // registered as acme/mine, but the tree's origin says acme/other
  const r = createRuntime({ root: base, project: specFor(other, "mine", "acme", "mine"), db: openStore(":memory:"), deps: deps() });
  const s = await r.tick();
  expect(s.reachable).toBe(false);
  // the named origin is the TREE'S OWN (other), never a sibling/kernel URL
  expect(s.errors.join("|")).toContain("acme/other");
  expect(s.errors.join("|")).toContain("registry names acme/mine");
});

test("a tree with NO remote is refused — and the refusal says (none), never another tree's URL", async () => {
  mkdirSync(join(base, "bare"), { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: join(base, "bare") });
  const r = createRuntime({ root: base, project: specFor(join(base, "bare"), "bare", "acme", "bare"), db: openStore(":memory:"), deps: deps() });
  const s = await r.tick();
  expect(s.reachable).toBe(false);
  // the guard's own wording: "(no remote)" — and CRITICALLY, no other tree's URL is named
  expect(s.errors.join("|")).toContain("(no remote)");
  expect(s.errors.join("|")).not.toContain("github.com");
});

test("the refused tick RECORDS — the status is written AND the tick advances (B1)", async () => {
  mkdirSync(join(base, "bare2"), { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: join(base, "bare2") });
  const root = base;
  const r = createRuntime({ root, project: specFor(join(base, "bare2"), "bare2", "acme", "bare2"), db: openStore(":memory:"), deps: deps() });
  const s1 = await r.tick();
  const s2 = await r.tick();
  expect(s2.tick).toBeGreaterThan(s1.tick);              // the tick ADVANCES (was stuck at 1)
  const { existsSync, readFileSync } = await import("node:fs");
  expect(existsSync(join(root, "runtime", "bare2", "status.json"))).toBe(true);
  expect(existsSync(join(root, "runtime", "bare2", "ticks.log"))).toBe(true);
  const log = readFileSync(join(root, "runtime", "bare2", "ticks.log"), "utf8").trim().split("\n");
  expect(log.length).toBe(2);                            // one row per tick (was 1 row in 2 h)
});
