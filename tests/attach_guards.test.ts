// attach_guards.test.ts — W2/W3's GATES: the REAL guards behind `upper attach`.
//
// EVERY guard is tested as POSITIVE + NEGATIVE halves. A refusal must be a NAMED token + a
// REMEDY; a legit case must pass with ZERO misfire. The three measured defect classes are pinned:
//   B3 — `hooksPath` → a missing dir (silently inert) MUST refuse loudly.
//   B5 — private + free plan MUST refuse BEFORE any copy.
//   B6 — the registry merge MUST preserve the legacy project.
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { realDeps, mergeRegistry } from "../src/attach-guards";
import { registryPath, legacyProject, type Registry } from "../src/projects";
import type { AttachTarget } from "../src/attach";

let base = "";
beforeEach(() => { base = mkdtempSync(join(tmpdir(), "aguard-")); });
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

/** a real git repo with an origin + the wiring (the "already attached" shape). */
function repo(dir: string, origin: string, withWiring = false): string {
  mkdirSync(dir, { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: dir });
  Bun.spawnSync(["git", "-C", dir, "remote", "add", "origin", origin]);
  if (withWiring) {
    mkdirSync(join(dir, ".githooks"), { recursive: true });
    writeFileSync(join(dir, ".githooks", "pre-commit"), "#!/bin/sh\n");
    chmodSync(join(dir, ".githooks", "pre-commit"), 0o755);
    mkdirSync(join(dir, "gates"), { recursive: true });
    mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
    Bun.spawnSync(["git", "-C", dir, "config", "core.hooksPath", ".githooks"]);
  }
  return dir;
}

function target(root: string, over: Partial<AttachTarget> = {}): AttachTarget {
  return { id: "proj", owner: "acme", repo: "proj", tokenEnv: "GH_TOKEN", host: "github.com", root, ...over };
}

/** a KERNEL fixture carrying the wiring to copy (so `realDeps(kernel)` can be exercised). */
function kernelFixture(): string {
  const k = join(base, "kernel");
  for (const d of ["gates", ".githooks", ".github/workflows"]) mkdirSync(join(k, d), { recursive: true });
  writeFileSync(join(k, "gates", "fence-check.py"), "# x\n");
  writeFileSync(join(k, ".githooks", "pre-commit"), "#!/bin/sh\n");
  writeFileSync(join(k, ".githooks", "pre-push"), "#!/bin/sh\n");
  writeFileSync(join(k, ".github", "workflows", "gates.yml"), "name: gates\n");
  writeFileSync(join(k, ".github", "workflows", "drift.yml"), "name: drift\n");
  return k;
}

// ═══════════════ STEP 4 · THE REMOTE GATE (test_attach_remote_gate) ═══════════════
test("test_attach_remote_gate — positive: a matching origin passes with zero misfire", () => {
  const w = repo(join(base, "ok"), "https://github.com/acme/proj.git");
  const v = realDeps(kernelFixture()).checkRemote(target(w));
  expect(v.ok).toBe(true);
  expect(v.refused).toBeUndefined();
});

test("test_attach_remote_gate — NEGATIVE: no origin refuses with the exact remedy", () => {
  const w = join(base, "noorigin");
  mkdirSync(w, { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: w });
  const v = realDeps(kernelFixture()).checkRemote(target(w));
  expect(v.ok).toBe(false);
  expect(v.refused).toContain("ATTACH-REMOTE-MISSING");
  expect(v.remedy).toContain("remote add origin");
});

test("test_attach_remote_gate — NEGATIVE: a SIBLING's origin refuses (naming both)", () => {
  const w = repo(join(base, "sib"), "https://github.com/acme/other.git");
  const v = realDeps(kernelFixture()).checkRemote(target(w));
  expect(v.ok).toBe(false);
  expect(v.refused).toContain("ATTACH-REMOTE-MISMATCH:acme/other");
  expect(v.remedy).toContain("remote set-url origin");
});

test("test_attach_remote_gate — NEGATIVE: a worktree with no remote of its own", () => {
  const main = repo(join(base, "main"), "https://github.com/acme/proj.git");
  writeFileSync(join(main, "f.txt"), "x\n");
  Bun.spawnSync(["git", "-C", main, "add", "-A"]);
  Bun.spawnSync(["git", "-C", main, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "i"]);
  const wt = join(base, "wt");
  Bun.spawnSync(["git", "-C", main, "worktree", "add", "-q", wt, "-b", "feat"]);
  const v = realDeps(kernelFixture()).checkRemote(target(wt));
  // a worktree SHARES the main repo's config → the origin is visible → the gate passes
  expect(v.ok).toBe(true);
});

// ═══════════════ STEP 6 · THE HOOKS GATE (test_attach_asserts_the_hooks_path — the B3 kill) ═══════════════
test("test_attach_asserts_the_hooks_path — NEGATIVE: hooksPath set, the dir ABSENT → LOUD refuse", () => {
  const w = join(base, "inert");
  mkdirSync(w, { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: w });
  Bun.spawnSync(["git", "-C", w, "config", "core.hooksPath", ".githooks"]);   // ← the B3 shape
  const d = realDeps(kernelFixture());
  const v = d.inspectHooks(target(w));
  expect(v.ok).toBe(false);
  expect(v.refused).toBe("ATTACH-HOOKS-INERT");
  expect(v.detail).toContain("ABSENT");
  expect(v.remedy).toContain("attach");
});

test("test_attach_asserts_the_hooks_path — POSITIVE: UNSET is the normal case (needed, not refused)", () => {
  const w = repo(join(base, "unset"), "https://github.com/acme/proj.git");
  const v = realDeps(kernelFixture()).inspectHooks(target(w));
  expect(v.ok).toBe(true);        // the attach SETS it — that is the job
  expect(v.needed).toBe(true);    // and the plan records the mutation
});

test("test_attach_asserts_the_hooks_path — NEGATIVE: a FOREIGN hooksPath refuses", () => {
  const w = repo(join(base, "foreign"), "https://github.com/acme/proj.git");
  Bun.spawnSync(["git", "-C", w, "config", "core.hooksPath", "custom-hooks"]);
  const v = realDeps(kernelFixture()).inspectHooks(target(w));
  expect(v.ok).toBe(false);
  expect(v.refused).toBe("ATTACH-HOOKS-FOREIGN");
  expect(v.remedy).toContain("core.hooksPath .githooks");
});

test("test_attach_asserts_the_hooks_path — NEGATIVE: a non-executable pre-commit refuses", () => {
  const w = repo(join(base, "noexec"), "https://github.com/acme/proj.git");
  mkdirSync(join(w, ".githooks"), { recursive: true });
  writeFileSync(join(w, ".githooks", "pre-commit"), "#!/bin/sh\n");
  chmodSync(join(w, ".githooks", "pre-commit"), 0o644);   // ← not executable
  Bun.spawnSync(["git", "-C", w, "config", "core.hooksPath", ".githooks"]);
  const v = realDeps(kernelFixture()).inspectHooks(target(w));
  expect(v.ok).toBe(false);
  expect(v.refused).toBe("ATTACH-HOOKS-NOT-EXEC");
  expect(v.remedy).toContain("chmod +x");
});

test("test_attach_asserts_the_hooks_path — POSITIVE: set + present + executable passes, and applyHooks converges", () => {
  const w = repo(join(base, "good"), "https://github.com/acme/proj.git", true);
  const d = realDeps(kernelFixture());
  const ins = d.inspectHooks(target(w));
  expect(ins.ok).toBe(true);
  expect(ins.needed).toBe(false);                // fully satisfied → no mutation
  const applied = d.applyHooks(target(w));
  expect(applied.ok).toBe(true);                        // the apply's OWN assert agrees with the inspect
  expect(applied.detail).toContain("asserted");
});

// ═══════════════ STEP 7 · THE REGISTRY MERGE (test_attach_registry_keeps_the_legacy_project — the B6 kill) ═══════════════
test("test_attach_registry_keeps_the_legacy_project — merging NEVER drops an existing project", () => {
  const k = kernelFixture();
  const existing: Registry = { projects: [{ id: "a", root: "/a", owner: "o", repo: "a", tokenEnv: "T", worktreeRoot: "/w", store: "/s.sqlite" }] };
  const spec = { id: "b", root: "/b", owner: "o", repo: "b", tokenEnv: "T", worktreeRoot: "/w", store: "/s2.sqlite" };
  const merged = mergeRegistry(existing, spec, k, { HOME: "/home/leviathan" } as never);
  expect(merged.projects.map((p) => p.id)).toContain("a");   // kept
  expect(merged.projects.map((p) => p.id)).toContain("b");   // added
});

test("test_attach_registry_keeps_the_legacy_project — a NEW registry is seeded with the env-legacy project", () => {
  const k = kernelFixture();
  const legacy = legacyProject(k, { HOME: "/home/leviathan" } as never);
  const spec = { id: "new", root: "/new", owner: "o", repo: "new", tokenEnv: "T", worktreeRoot: "/w", store: "/s.sqlite" };
  const merged = mergeRegistry({ projects: [] }, spec, k, { HOME: "/home/leviathan" } as never);
  expect(merged.projects.map((p) => p.id)).toContain(legacy.id);   // ← the B6 kill
  expect(merged.projects.map((p) => p.id)).toContain("new");
});

test("test_attach_registry_keeps_the_legacy_project — a re-merge is idempotent (no duplicate id)", () => {
  const k = kernelFixture();
  const spec = { id: "x", root: "/x", owner: "o", repo: "x", tokenEnv: "T", worktreeRoot: "/w", store: "/s.sqlite" };
  const once = mergeRegistry({ projects: [] }, spec, k, { HOME: "/h" } as never);
  const twice = mergeRegistry(once, spec, k, { HOME: "/h" } as never);
  expect(twice.projects.filter((p) => p.id === "x").length).toBe(1);
  expect(twice.projects.length).toBe(once.projects.length);
});

test("the registry inspect refuses a CORRUPT registry (never a silent overwrite)", () => {
  const k = kernelFixture();
  writeFileSync(registryPath(k), "{ not json");
  const v = realDeps(k).inspectRegistry(target("/x"));
  expect(v.refused).toBe("ATTACH-REGISTRY-CORRUPT");
  expect(v.remedy).toContain(".bak");
});

// ═══════════════ STEP 5 · THE WIRING (test_attach_copies_the_full_wiring — the B4 kill) ═══════════════
test("test_attach_copies_the_full_wiring — the copy lands gates/ + .githooks/ + the workflows", () => {
  const k = kernelFixture();
  const w = repo(join(base, "bare"), "https://github.com/acme/proj.git");
  const d = realDeps(k);
  expect(d.inspectWiring(target(w)).needed).toBe(true);          // nothing there yet
  const r = d.applyWiring(target(w));
  expect(r.ok).toBe(true);
  expect(existsSync(join(w, "gates", "fence-check.py"))).toBe(true);
  expect(existsSync(join(w, ".githooks", "pre-commit"))).toBe(true);
  expect(existsSync(join(w, ".github", "workflows", "gates.yml"))).toBe(true);
  expect(d.inspectWiring(target(w)).needed).toBe(false);         // and now it is satisfied
});

test("test_attach_copies_the_full_wiring — a KERNEL missing a required surface refuses", () => {
  const k = join(base, "thin-kernel");
  mkdirSync(join(k, "gates"), { recursive: true });               // no .githooks, no workflows
  const w = repo(join(base, "bare2"), "https://github.com/acme/proj.git");
  const r = realDeps(k).applyWiring(target(w));
  expect(r.ok).toBe(false);
  expect(r.refused).toBe("ATTACH-KERNEL-INCOMPLETE");
  expect(r.remedy).toContain("the kernel must carry all three");
});

// ═══════════════ STEP 3 · THE REPO GATE (test_attach_refuses_private_free_early — the B5 kill) ═══════════════
test("test_attach_refuses_private_free_early — NO token refuses before any network call", async () => {
  const v = await realDeps(kernelFixture()).checkRepo(target("/x"), { path: "/x" });
  expect(v.refused).toBe("ATTACH-DISARMED");
  expect(v.remedy).toContain("jarvis-upper.env");
});

test("test_attach_refuses_private_free_early — a 404 refuses with the gh repo create line", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response("{}", { status: 404 })) as never;
  try {
    const v = await realDeps(kernelFixture()).checkRepo(target("/x"), { path: "/x", token: "t" });
    expect(v.refused).toContain("ATTACH-NO-REPO:acme/proj");
    expect(v.remedy).toContain("gh repo create");
  } finally { globalThis.fetch = real; }
});

test("test_attach_refuses_private_free_early — PRIVATE + plan=free refuses (the measured 403)", async () => {
  const real = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async () => {
    call++;
    if (call === 1) return new Response(JSON.stringify({ private: true, visibility: "private" }), { status: 200 });
    return new Response(JSON.stringify({ plan: { name: "free" } }), { status: 200 });
  }) as never;
  try {
    const v = await realDeps(kernelFixture()).checkRepo(target("/x"), { path: "/x", token: "t" });
    expect(v.refused).toBe("ATTACH-PRIVATE-FREE-REPO");
    expect(v.remedy).toContain("--visibility public");
  } finally { globalThis.fetch = real; }
});

test("test_attach_refuses_private_free_early — POSITIVE: a PUBLIC repo passes with zero misfire", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ private: false, visibility: "public" }), { status: 200 })) as never;
  try {
    const v = await realDeps(kernelFixture()).checkRepo(target("/x"), { path: "/x", token: "t" });
    expect(v.ok).toBe(true);
    expect(v.detail).toContain("public");
  } finally { globalThis.fetch = real; }
});

test("test_attach_refuses_private_free_early — a PRIVATE repo on a PRO plan passes", async () => {
  const real = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async () => {
    call++;
    if (call === 1) return new Response(JSON.stringify({ private: true, visibility: "private" }), { status: 200 });
    return new Response(JSON.stringify({ plan: { name: "pro" } }), { status: 200 });
  }) as never;
  try {
    const v = await realDeps(kernelFixture()).checkRepo(target("/x"), { path: "/x", token: "t" });
    expect(v.ok).toBe(true);       // a Pro account CAN carry a ruleset on a private repo
  } finally { globalThis.fetch = real; }
});

test("THE SEAT'S FINDING — a TRAILING-SLASH kernel root must NOT re-seed the legacy project", () => {
  // measured live: the CLI's root is `…/jarvis-upper/` while the registry's entry is `…/jarvis-upper`
  // — a raw `===` failed, so a non-dry attach wrote a DUPLICATE legacy row.
  const k = "/kernel";
  const withSlash = `${k}/`;
  const legacy = legacyProject(withSlash, { HOME: "/h" } as never);
  // the registry already covers the kernel (no trailing slash), and the SPEC is a DIFFERENT project
  const reg: Registry = { projects: [{ ...legacy, root: k }] };
  const spec = { id: "newproj", root: "/other", owner: "o", repo: "newproj", tokenEnv: "T", worktreeRoot: "/w", store: "/s.sqlite" };
  const merged = mergeRegistry(reg, spec, withSlash, { HOME: "/h" } as never);
  // exactly TWO: the covered legacy + the new spec — NOT a duplicated legacy
  expect(merged.projects.filter((p) => p.id === legacy.id).length).toBe(1);
  expect(merged.projects.length).toBe(2);
});

test("THE SEAT'S FINDING — a genuinely UNCOVERED kernel still seeds the legacy project", () => {
  const k = "/kernel";
  const spec = { id: "newproj", root: "/other", owner: "o", repo: "newproj", tokenEnv: "T", worktreeRoot: "/w", store: "/s.sqlite" };
  const merged = mergeRegistry({ projects: [] }, spec, k, { HOME: "/h" } as never);
  const legacy = legacyProject(k, { HOME: "/h" } as never);
  expect(merged.projects.map((p) => p.id)).toContain(legacy.id);
});
