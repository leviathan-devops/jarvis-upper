// attach_verb.test.ts — W2's GATES: the VERB end-to-end (`test_attach_dry_changes_nothing`,
// `test_attach_is_idempotent`). These drive the real verb against a TEMP kernel + a temp target,
// so the LIVE registry is never touched (the test-isolation audit).
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verbAttach } from "../src/cli-verbs";
import { registryPath } from "../src/projects";

let base = "";
const REAL_TOKEN = process.env.GH_TOKEN;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "averb-"));
  // the repo gate is credential-gated BY DESIGN; the tests supply a (stubbed) token so the
  // REMOTE-facing step can be exercised. The real env is restored after.
  process.env.GH_TOKEN = "test-token-not-a-secret";
});
afterEach(() => {
  rmSync(base, { recursive: true, force: true });
  if (REAL_TOKEN === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = REAL_TOKEN;
});

/** a temp KERNEL carrying the wiring to copy + no registry. */
function kernel(): string {
  const k = join(base, "kernel");
  for (const d of ["gates", ".githooks", ".github/workflows"]) mkdirSync(join(k, d), { recursive: true });
  writeFileSync(join(k, "gates", "fence-check.py"), "# fence\n");
  writeFileSync(join(k, "gates", "rt-preflight.sh"), "#!/bin/sh\n");
  writeFileSync(join(k, ".githooks", "pre-commit"), "#!/bin/sh\n");
  writeFileSync(join(k, ".githooks", "pre-push"), "#!/bin/sh\n");
  writeFileSync(join(k, ".github", "workflows", "gates.yml"), "name: gates\n");
  writeFileSync(join(k, ".github", "workflows", "drift.yml"), "name: drift\n");
  return k;
}

/** a target repo whose origin names acme/proj (the guard's pass case). */
function targetRepo(): string {
  const w = join(base, "proj");
  mkdirSync(w, { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: w });
  Bun.spawnSync(["git", "-C", w, "remote", "add", "origin", "https://github.com/acme/proj.git"]);
  return w;
}

const gitStatus = (d: string) => Bun.spawnSync(["git", "-C", d, "status", "--porcelain"], { stdout: "pipe" }).stdout?.toString() ?? "";

/** stub a GitHub API that says: the repo exists and is PUBLIC (the ruleset-eligible case). */
function stubPublicRepo() {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ private: false, visibility: "public" }), { status: 200 })) as never;
  return () => { globalThis.fetch = real; };
}

// ═══════════════ test_attach_dry_changes_nothing ═══════════════
test("test_attach_dry_changes_nothing — the plan prints and the world is untouched", async () => {
  const k = kernel(), w = targetRepo();
  const restore = stubPublicRepo();
  try {
    const before = gitStatus(w);
    const r = await verbAttach(k, w, "--dry");
    expect(r.code).toBe(0);
    expect(r.out.dry).toBe(true);
    expect(Array.isArray(r.out.steps)).toBe(true);
    expect((r.out.steps as unknown[]).length).toBe(8);
    // THE WORLD IS UNTOUCHED: no wiring copied, no registry written, the tree byte-identical
    expect(existsSync(join(w, "gates"))).toBe(false);
    expect(existsSync(join(w, ".githooks"))).toBe(false);
    expect(existsSync(registryPath(k))).toBe(false);
    expect(gitStatus(w)).toBe(before);
    expect((r.out.mutations as number)).toBeGreaterThan(0);   // it WOULD change things
  } finally { restore(); }
});

// ═══════════════ test_attach_is_idempotent ═══════════════
test("test_attach_is_idempotent — the first run applies; the SECOND is a noop", async () => {
  const k = kernel(), w = targetRepo();
  const restore = stubPublicRepo();
  try {
    const r1 = await verbAttach(k, w);
    expect(r1.code).toBe(0);
    expect(r1.out.ok).toBe(true);
    expect(r1.out.action).toBe("applied");
    // the wiring landed + the hooks are set + the registry holds the entry
    expect(existsSync(join(w, "gates", "fence-check.py"))).toBe(true);
    expect(existsSync(join(w, ".githooks", "pre-commit"))).toBe(true);
    expect(existsSync(registryPath(k))).toBe(true);
    const hp = Bun.spawnSync(["git", "-C", w, "config", "core.hooksPath"], { stdout: "pipe" }).stdout?.toString().trim();
    expect(hp).toBe(".githooks");

    // THE SECOND RUN — every step satisfied → the plan mutates NOTHING → action=noop
    const r2 = await verbAttach(k, w);
    expect(r2.code).toBe(0);
    expect(r2.out.action).toBe("noop");
    expect((r2.out.report as string[]).join("|")).toContain("noop");
  } finally { restore(); }
});

test("the verb refuses an unknown flag (never a silent accept)", async () => {
  const k = kernel(), w = targetRepo();
  const r = await verbAttach(k, w, "--typo");
  expect(r.code).toBe(2);
  expect(r.out.refused).toBe("ATTACH-UNKNOWN-FLAG");
});

test("the verb refuses without a path", async () => {
  const r = await verbAttach(kernel());
  expect(r.code).toBe(2);
  expect(r.out.refused).toBe("ATTACH-NEEDS-A-PATH");
});

test("the verb refuses a NON-git target with a remedy (exit 2, not a stack)", async () => {
  const k = kernel();
  const notgit = join(base, "notgit");
  mkdirSync(notgit, { recursive: true });
  const r = await verbAttach(k, notgit);
  expect(r.code).toBe(2);
  expect(String(r.out.refused)).toContain("ATTACH-NOT-A-REPO");
  expect(String(r.out.remedy)).toContain("git -C");
});

test("the verb refuses a target whose origin is a SIBLING (exit 2, the exact remedy)", async () => {
  const k = kernel();
  const w = join(base, "sibling");
  mkdirSync(w, { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: w });
  Bun.spawnSync(["git", "-C", w, "remote", "add", "origin", "https://github.com/acme/OTHER.git"]);
  const restore = stubPublicRepo();
  try {
    // THE GATE ONLY BITES when the target is DECLARED: with owner/repo derived from the origin,
    // the remote check trivially matches itself (a test that proved nothing — fixed by running).
    const r = await verbAttach(k, w, "--owner", "acme", "--repo", "proj");
    expect(r.code).toBe(2);
    expect(String(r.out.refused)).toContain("ATTACH-REMOTE-MISMATCH");
    expect(String(r.out.remedy)).toContain("remote set-url origin");
  } finally { restore(); }
});

test("the verb refuses a target with NO remote — and names the missing registration", async () => {
  const k = kernel();
  const w = join(base, "noorigin");
  mkdirSync(w, { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: w });
  const r = await verbAttach(k, w);
  expect(r.code).toBe(2);
  expect(String(r.out.refused)).toContain("ATTACH-NO-TARGET");
  expect(String(r.out.remedy)).toContain("remote add origin");
});

// ═══ THE FIRST-OPERATOR PRIVILEGE: the wiring lands EXECUTABLE (the B3 half) ═══
test("the applied hooks are EXECUTABLE — a non-exec hook is the silent-inert cousin", async () => {
  const k = kernel(), w = targetRepo();
  const restore = stubPublicRepo();
  try {
    const r = await verbAttach(k, w);
    expect(r.code).toBe(0);
    const st = Bun.spawnSync(["test", "-x", join(w, ".githooks", "pre-commit")]);
    expect(st.exitCode).toBe(0);
    void chmodSync;
  } finally { restore(); }
});
