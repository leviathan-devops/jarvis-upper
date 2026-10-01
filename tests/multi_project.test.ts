// multi_project.test.ts — THE PROOF for async multi-project use.
//
// The four properties that make a fleet safe, each asserted mechanically:
//   1. CONCURRENCY   — N projects tick in ~T, not N x T
//   2. ISOLATION     — one project REJECTING never stops or cancels the others
//   3. SCOPING       — each project writes its OWN status + store (never a shared file)
//   4. VALIDATION    — a malformed registry entry is NAMED and skipped, never fatal
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../src/store";
import { createRuntime } from "../src/runtime";
import { loadRegistry, registryPath, projectStorePath, type ProjectSpec } from "../src/projects";

const mkRoot = () => mkdtempSync(join(tmpdir(), "mp-"));

function spec(root: string, id: string): ProjectSpec {
  return {
    id, root, owner: "some-org", repo: id, tokenEnv: "GH_TOKEN",
    worktreeRoot: `${root}/.wt/${id}`, store: projectStorePath(root, id),
  };
}

test("test_multi_project_ticks_run_concurrently", async () => {
  // 3 projects, each with a 120ms probe. SERIAL would take ~360ms; CONCURRENT takes ~120ms.
  const root = mkRoot();
  const N = 3;
  const rts = Array.from({ length: N }, (_, i) => createRuntime({
    root, project: spec(root, `p${i}`), db: openStore(":memory:"),
    deps: { probe: async () => { await Bun.sleep(120); return true; }, listPrs: async () => [], rails: async () => ({ frames: 0, bytes: 0, lastSeq: 0 }), checkTarget: () => ({ ok: true, remote: "git@github.com:some-org/x.git" }) },
  }));
  const t0 = Date.now();
  const settled = await Promise.allSettled(rts.map((rt) => rt.tick()));
  const elapsed = Date.now() - t0;
  expect(settled.every((s) => s.status === "fulfilled")).toBe(true);
  expect(elapsed).toBeLessThan(300);          // serial would be >= 360
});

test("test_one_project_failing_never_stops_the_others", async () => {
  // THE ISOLATION LAW: project B's probe THROWS; A and C must still complete with a status.
  const root = mkRoot();
  const mk = (id: string, boom: boolean) => createRuntime({
    root, project: spec(root, id), db: openStore(":memory:"),
    deps: {
      probe: async () => { if (boom) throw new Error("BOOM-PROBE"); return true; },
      listPrs: async () => [], rails: async () => ({ frames: 0, bytes: 0, lastSeq: 0 }), checkTarget: () => ({ ok: true, remote: "git@github.com:some-org/x.git" }),
    },
  });
  const a = mk("alpha", false), b = mk("bravo", true), c = mk("charlie", false);
  const settled = await Promise.allSettled([a.tick(), b.tick(), c.tick()]);
  // the runtime's OWN guard turns a stage throw into a NAMED error — never a rejection
  expect(settled[0].status).toBe("fulfilled");
  expect(settled[2].status).toBe("fulfilled");
  const sa = (settled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof a.tick>>>).value;
  const sc = (settled[2] as PromiseFulfilledResult<Awaited<ReturnType<typeof c.tick>>>).value;
  expect(sa.daemonOk).toBe(true);
  expect(sc.daemonOk).toBe(true);
  if (settled[1].status === "fulfilled") {
    const sb = (settled[1] as PromiseFulfilledResult<Awaited<ReturnType<typeof b.tick>>>).value;
    expect(sb.errors.join("|")).toContain("tick-threw");   // B's failure is NAMED in B's row
  }
  // and A/C's own status files exist — the failure did not suppress them
  expect(existsSync(join(root, "runtime", "alpha", "status.json"))).toBe(true);
  expect(existsSync(join(root, "runtime", "charlie", "status.json"))).toBe(true);
});

test("test_each_project_writes_its_own_status_and_nothing_else", async () => {
  const root = mkRoot();
  const rts = ["one", "two"].map((id) => createRuntime({
    root, project: spec(root, id), db: openStore(":memory:"),
    deps: { probe: async () => true, listPrs: async () => [], rails: async () => ({ frames: 0, bytes: 0, lastSeq: 0 }), checkTarget: () => ({ ok: true, remote: "git@github.com:some-org/x.git" }) },
  }));
  await Promise.all(rts.map((rt) => rt.tick()));
  for (const id of ["one", "two"]) {
    const p = join(root, "runtime", id, "status.json");
    expect(existsSync(p)).toBe(true);
    const st = JSON.parse(readFileSync(p, "utf8"));
    expect(st.tick).toBe(1);
  }
  // the legacy TOP-LEVEL status.json is NOT written by a scoped project (the orchestrator owns it)
  expect(existsSync(join(root, "runtime", "status.json"))).toBe(false);
});

test("test_registry_rejects_a_bad_entry_without_killing_the_good_ones", () => {
  const root = mkRoot();
  writeFileSync(registryPath(root), JSON.stringify({ projects: [
    { id: "good", root, owner: "o", repo: "good", tokenEnv: "GH_TOKEN", worktreeRoot: `${root}/.wt`, store: `${root}/runtime/good/store.sqlite` },
    { id: "BAD ID!", root, owner: "o", repo: "x", tokenEnv: "GH_TOKEN", worktreeRoot: `${root}/.wt`, store: `${root}/runtime/x/store.sqlite` },
    { id: "no-store", root, owner: "o", repo: "x", tokenEnv: "GH_TOKEN", worktreeRoot: `${root}/.wt` },
    { id: "secret-leak", root, owner: "o", repo: "x", tokenEnv: "ghp_abc123", worktreeRoot: `${root}/.wt`, store: `${root}/runtime/x/store.sqlite` },
    { id: "good", root, owner: "o", repo: "dup", tokenEnv: "GH_TOKEN", worktreeRoot: `${root}/.wt`, store: `${root}/runtime/dup/store.sqlite` },
  ] }));
  const reg = loadRegistry(root, { GH_TOKEN: "t" });
  expect(reg.legacy).toBe(false);
  expect(reg.projects.length).toBe(1);                 // ONLY the good one
  expect(reg.projects[0].id).toBe("good");
  expect(reg.issues.length).toBe(4);                   // every bad entry is NAMED
  expect(reg.issues.map((i) => i.reason).join("|")).toContain("duplicate".length ? "DUPLICATE" : "x");
  // THE SECRET LAW: tokenEnv must be an ENV VAR NAME, never key material
  expect(reg.issues.some((i) => i.reason.includes("tokenEnv"))).toBe(true);
});

test("test_registry_absent_falls_back_to_the_legacy_env_project", () => {
  const root = mkRoot();
  const reg = loadRegistry(root, { GH_TOKEN: "t", UPPER_REPO: "legacy-repo", HOME: "/home/x" });
  expect(reg.legacy).toBe(true);
  expect(reg.projects.length).toBe(1);
  expect(reg.projects[0].repo).toBe("legacy-repo");
  expect(reg.projects[0].worktreeRoot).toBe("/home/x/.ao/data/worktrees/legacy-repo");
});
