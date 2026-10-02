// attach_plan.test.ts — W1's GATE: `attachPlan` is PURE (mutates nothing) and the step table is
// the contract. The plan is the `--dry` engine AND the test surface; if it mutates, the dry mode
// is a lie and every preview is a side effect.
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { attachPlan, attachApply, deriveId, parseOrigin, ATTACH_STEP_ORDER, type AttachDeps } from "../src/attach";

let base = "";
beforeEach(() => { base = mkdtempSync(join(tmpdir(), "attach-")); });
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

/** a real git repo with an origin and a commit. */
function repo(dir: string, origin: string): string {
  mkdirSync(dir, { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: dir });
  Bun.spawnSync(["git", "-C", dir, "remote", "add", "origin", origin]);
  writeFileSync(join(dir, "README.md"), "# x\n");
  Bun.spawnSync(["git", "-C", dir, "add", "-A"]);
  Bun.spawnSync(["git", "-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init"]);
  return dir;
}

/** a fully-passing deps fixture: every guard says ok, nothing mutates (the pure plan only reads). */
function deps(over: Partial<AttachDeps> = {}): AttachDeps {
  return {
    // the probe reads the REAL temp repo (the DI seam is for production purity; a test fixture
    // legitimately reads git).
    readOrigin: (root: string) => {
      const inside = Bun.spawnSync(["git", "-C", root, "rev-parse", "--is-inside-work-tree"], { stdout: "pipe", stderr: "pipe" });
      if (inside.exitCode !== 0 || inside.stdout?.toString().trim() !== "true") return { url: null, isRepo: false };
      const u = Bun.spawnSync(["git", "-C", root, "remote", "get-url", "origin"], { stdout: "pipe", stderr: "pipe" });
      const url = u.exitCode === 0 ? (u.stdout?.toString().trim() || null) : null;
      return { url, isRepo: true };
    },
    checkRepo: async () => ({ ok: true, detail: "repo exists, public, ruleset-eligible" }),
    checkRemote: () => ({ ok: true, detail: "origin matches" }),
    inspectWiring: () => ({ needed: true, detail: "would copy gates/ .githooks/ workflows/" }),
    inspectHooks: () => ({ ok: true, needed: false, detail: "hooksPath set + the dir present + executable" }),
    inspectRegistry: () => ({ needed: true, detail: "would add the entry" }),
    applyWiring: () => ({ ok: true, copied: ["gates/x"], skipped: [], backedUp: [], detail: "copied" }),
    applyHooks: () => ({ ok: true, detail: "set + asserted" }),
    applyRegistry: () => ({ ok: true, detail: "merged" }),
    ...over,
  };
}

const gitStatus = (d: string) => Bun.spawnSync(["git", "-C", d, "status", "--porcelain"], { stdout: "pipe" }).stdout?.toString() ?? "";

// ═══ THE GATE: test_attach_plan_is_pure ═══
test("test_attach_plan_is_pure — the tree is byte-identical after the plan", async () => {
  const w = repo(join(base, "proj"), "https://github.com/acme/proj.git");
  const before = gitStatus(w);
  const regBefore = existsSync(join(w, "…")) ? "" : "none";
  const plan = await attachPlan({ path: w }, deps());
  const after = gitStatus(w);
  expect(after).toBe(before);                       // nothing staged/modified/untracked
  expect(after).toBe("");                           // and the tree was clean to begin with
  expect(plan.steps.length).toBe(8);                // all 8 steps computed
  expect(plan.steps.map((s) => s.id)).toEqual(ATTACH_STEP_ORDER);   // the order IS the contract
  void regBefore;
});

// ═══ ADVERSARIAL FIRST: the refusals (before any happy path) ═══
test("test_attach_refuses_a_non_git_path", async () => {
  const bare = join(base, "notgit");
  mkdirSync(bare, { recursive: true });
  const plan = await attachPlan({ path: bare }, deps());
  expect(plan.refused).toContain("ATTACH-NOT-A-REPO");
  expect(plan.remedy).toContain("git -C");           // EVERY refusal carries its remedy
  expect(plan.steps.find((s) => s.id === "preflight")?.ok).toBe(false);
});

test("test_attach_refuses_a_missing_path", async () => {
  const plan = await attachPlan({ path: join(base, "nope") }, deps());
  expect(plan.refused).toContain("ATTACH-NOT-A-PATH");
  expect(plan.remedy).toContain("mkdir -p");
});

test("test_attach_refuses_when_no_target_can_be_derived", async () => {
  const w = repo(join(base, "notarget"), "https://github.com/acme/x.git");
  Bun.spawnSync(["git", "-C", w, "remote", "remove", "origin"]);
  const plan = await attachPlan({ path: w }, deps());
  expect(plan.refused).toContain("ATTACH-NO-TARGET");
  expect(plan.remedy).toContain("remote add origin");
});

test("test_attach_refuses_private_free_early — before ANY mutation", async () => {
  const w = repo(join(base, "priv"), "https://github.com/acme/priv.git");
  const plan = await attachPlan({ path: w }, deps({
    checkRepo: async () => ({ ok: false, refused: "ATTACH-PRIVATE-FREE-REPO", remedy: "gh repo edit acme/priv --visibility public   # or upgrade to Pro", detail: "PRIVATE + plan=free → rulesets unavailable" }),
  }));
  expect(plan.refused).toBe("ATTACH-PRIVATE-FREE-REPO");
  expect(plan.remedy).toContain("--visibility public");
  expect(plan.mutations).toBe(0);                    // NO step would mutate — refused at the gate
});

test("test_attach_asserts_the_hooks_path — a missing dir MUST refuse (the B3 kill)", async () => {
  const w = repo(join(base, "inert"), "https://github.com/acme/inert.git");
  const plan = await attachPlan({ path: w }, deps({
    inspectHooks: () => ({ ok: false, needed: true, refused: "ATTACH-HOOKS-INERT", remedy: `git -C ${w} config core.hooksPath .githooks   # after the wiring lands`, detail: "hooksPath set but the dir is ABSENT — every commit would be ungated" }),
  }));
  expect(plan.refused).toBe("ATTACH-HOOKS-INERT");
  expect(plan.remedy).toContain("core.hooksPath");
});

// ═══ THE HAPPY PATH LAST ═══
test("a fully-satisfied target yields a plan with ZERO mutations (idempotence)", async () => {
  const w = repo(join(base, "done"), "https://github.com/acme/done.git");
  const plan = await attachPlan({ path: w }, deps({
    inspectWiring: () => ({ needed: false, detail: "the wiring is already present" }),
    inspectRegistry: () => ({ needed: false, detail: "the entry is already present" }),
  }));
  expect(plan.refused).toBeUndefined();
  expect(plan.mutations).toBe(0);                    // a second attach is a noop
  expect(plan.target.id).toBe("done");
  expect(plan.target.owner).toBe("acme");
});

// ═══ THE APPLY (the only mutator) ═══
test("attachApply refuses to run a refused plan", async () => {
  const w = repo(join(base, "r2"), "https://github.com/acme/r2.git");
  const plan = await attachPlan({ path: w }, deps({ checkRepo: async () => ({ ok: false, refused: "ATTACH-NO-REPO", remedy: "gh repo create acme/r2", detail: "absent" }) }));
  const res = await attachApply(plan, { path: w }, deps());
  expect(res.applied).toBe(false);
  expect(res.report.join("|")).toContain("refused before apply");
});

test("attachApply runs the three mutators IN ORDER and reports each", async () => {
  const w = repo(join(base, "ok"), "https://github.com/acme/ok.git");
  const order: string[] = [];
  // every step is NEEDED here (the idempotence rule skips a satisfied step — so to observe the
  // three-mutator ORDER the plan must mark all three as needed).
  const plan = await attachPlan({ path: w }, deps({
    inspectWiring: () => ({ needed: true, detail: "would copy" }),
    inspectHooks: () => ({ ok: true, needed: true, detail: "unset — will set" }),
    inspectRegistry: () => ({ needed: true, detail: "would add" }),
  }));
  const res = await attachApply(plan, { path: w }, deps({
    inspectHooks: () => ({ ok: true, needed: true, detail: "unset — will set" }),
    applyWiring: () => { order.push("wiring"); return { ok: true, copied: ["a"], skipped: [], backedUp: [], detail: "copied" }; },
    applyHooks: () => { order.push("hooks"); return { ok: true, detail: "set + asserted" }; },
    applyRegistry: () => { order.push("registry"); return { ok: true, detail: "merged" }; },
  }));
  expect(res.applied).toBe(true);
  expect(order).toEqual(["wiring", "hooks", "registry"]);   // the order IS the contract
  expect(res.report.join("|")).toContain("NEXT:");
});

test("attachApply SKIPS a satisfied step — a second attach writes nothing (the idempotence rule)", async () => {
  const w = repo(join(base, "satisfied"), "https://github.com/acme/satisfied.git");
  let wiringCalls = 0;
  const plan = await attachPlan({ path: w }, deps({
    inspectWiring: () => ({ needed: false, detail: "already present" }),
    inspectHooks: () => ({ ok: true, needed: false, detail: "already set" }),
    inspectRegistry: () => ({ needed: false, detail: "already present" }),
  }));
  const res = await attachApply(plan, { path: w }, deps({
    applyWiring: () => { wiringCalls++; return { ok: true, copied: [], skipped: [], backedUp: [], detail: "x" }; },
  }));
  expect(res.applied).toBe(true);
  expect(wiringCalls).toBe(0);                       // NOT called — the step was satisfied
  expect(res.report.join("|")).toContain("noop");
});

// ═══ THE PARSER (the derive surface) ═══
test("parseOrigin handles https / ssh / scp-like, and rejects a non-repo path", () => {
  expect(parseOrigin("https://github.com/acme/x.git")).toEqual({ owner: "acme", repo: "x", host: "github.com" });
  expect(parseOrigin("git@github.com:acme/y.git")).toEqual({ owner: "acme", repo: "y", host: "github.com" });
  expect(parseOrigin("ssh://git@github.com/acme/z")).toEqual({ owner: "acme", repo: "z", host: "github.com" });
  expect(parseOrigin("https://github.com/acme/extra/x.git")).toBeNull();   // exactly two segments
  expect(parseOrigin("")).toBeNull();
});

test("deriveId sanitizes the path's last segment", () => {
  expect(deriveId("/a/b/my-proj")).toBe("my-proj");
  expect(deriveId("/a/b/My Proj!")).toBe("My-Proj-");
  expect(deriveId("/")).toBe("project");
});
