// rebuilld.test.ts — THE AUDIT §6 REBUILD REQUIREMENTS: the pins for the D/G/H/09/11 fixes.
// Each test names the requirement it proves (§6's numbered list in
// forensic/FAILURE_LEDGER_MULTIPROJECT.md).
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadRegistry, resolveStorePath } from "../src/projects";
import { rulesetFor, enroll } from "../src/enroll";
import { makeCycle, type Enrolled } from "../src/main";
import type { Runtime } from "../src/runtime";
import type { RuntimeStatus, AggregateStatus } from "../src/status";
import { statusPath } from "../src/status";
import { Database } from "bun:sqlite";
import { guardrail } from "../src/guardrail";

let root = "";
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "rb-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

// ═══ §6 req 6 (HIGH E): the registry REFUSES two entries with one store ═══
test("req6: two registry entries pointing at ONE store are refused (HIGH E)", () => {
  const shared = join(root, "s.sqlite");
  const mk = (id: string) => ({ id, root, owner: "o", repo: "r", tokenEnv: "T", worktreeRoot: root, store: shared });
  writeFileSync(join(root, "projects.json"), JSON.stringify({ projects: [mk("a"), mk("b")] }));
  const reg = loadRegistry(root, {});
  expect(reg.projects.map((p) => p.id)).toEqual(["a"]);
  expect(reg.issues.some((i) => i.reason.includes("DUPLICATE store"))).toBe(true);
  expect(reg.legacy).toBe(false);
});

test("req6: two entries with DISTINCT stores both load", () => {
  const mk = (id: string) => ({ id, root, owner: "o", repo: "r", tokenEnv: "T", worktreeRoot: root, store: join(root, `${id}.sqlite`) });
  writeFileSync(join(root, "projects.json"), JSON.stringify({ projects: [mk("a"), mk("b")] }));
  const reg = loadRegistry(root, {});
  expect(reg.projects.map((p) => p.id)).toEqual(["a", "b"]);
  expect(reg.issues).toEqual([]);
});

// ═══ §6 req 5 (HIGH D): resolveStorePath names the project's store, refuses ambiguity ═══
test("req5: a one-project registry resolves its store implicitly (zero regression)", () => {
  const mk = { id: "solo", root, owner: "o", repo: "r", tokenEnv: "T", worktreeRoot: root, store: join(root, "solo.sqlite") };
  writeFileSync(join(root, "projects.json"), JSON.stringify({ projects: [mk] }));
  expect(resolveStorePath(root, {})).toBe(join(root, "solo.sqlite"));
});

test("req5: a MANY-project registry REQUIRES --project (ambiguity is a named refusal)", () => {
  const mk = (id: string) => ({ id, root, owner: "o", repo: "r", tokenEnv: "T", worktreeRoot: root, store: join(root, `${id}.sqlite`) });
  writeFileSync(join(root, "projects.json"), JSON.stringify({ projects: [mk("a"), mk("b")] }));
  expect(() => resolveStorePath(root, {})).toThrow(/AMBIGUOUS-STORE/);       // never a silent root-store read
  expect(resolveStorePath(root, {}, "b")).toBe(join(root, "b.sqlite"));      // named → resolves
  expect(() => resolveStorePath(root, {}, "zzz")).toThrow(/NO-PROJECT:zzz/);
});

test("req5: UPPER_PROJECT env names the store", () => {
  const mk = (id: string) => ({ id, root, owner: "o", repo: "r", tokenEnv: "T", worktreeRoot: root, store: join(root, `${id}.sqlite`) });
  writeFileSync(join(root, "projects.json"), JSON.stringify({ projects: [mk("a"), mk("b")] }));
  expect(resolveStorePath(root, { UPPER_PROJECT: "a" })).toBe(join(root, "a.sqlite"));
});

// ═══ §6 req 8 (HIGH G): the arm payload's factoryContexts are DERIVED ═══
test("req8: rulesetFor derives the 8 vs 6 contexts (the third-copy drift is dead)", () => {
  const eight = rulesetFor({ factoryContexts: true }) as { rules: { type: string; parameters?: { required_status_checks?: { context: string }[] } }[] };
  const r8 = eight.rules.find((r) => r.type === "required_status_checks")!;
  expect(r8.parameters!.required_status_checks!.length).toBe(8);
  const six = rulesetFor({ factoryContexts: false }) as typeof eight;
  const r6 = six.rules.find((r) => r.type === "required_status_checks")!;
  expect(r6.parameters!.required_status_checks!.length).toBe(6);
});

test("the arm payload's approval requirement is SOLO-SATISFIABLE (the live PR-2 deadlock)", () => {
  // MEASURED LIVE: `*_count:1` + `require_last_push_approval:true` with ONE collaborator (who
  // authors every PR) is DEAD BY CONSTRUCTION — GitHub blocks self-approval (422), so the merge
  // button can never unlock. The payload must not install an unsatisfiable gate.
  const rs = rulesetFor({ factoryContexts: true }) as { rules: { type: string; parameters?: { required_approving_review_count?: number; require_last_push_approval?: boolean } }[] };
  const pr = rs.rules.find((r) => r.type === "pull_request")!;
  expect(pr.parameters!.required_approving_review_count).toBe(0);
  expect(pr.parameters!.require_last_push_approval).toBe(false);
});

// ═══ §6 req 9 (HIGH H): enroll backs up a differing foreign file ═══
test("req9: enroll NEVER destroys a foreign file silently — it backs it up (HIGH H)", () => {
  // a kernel tree with a gate, and a target that already carries a DIFFERENT .githooks/pre-commit
  const kernel = join(root, "kernel");
  mkdirSync(join(kernel, "gates"), { recursive: true });
  mkdirSync(join(kernel, ".githooks"), { recursive: true });
  writeFileSync(join(kernel, "gates", "g.sh"), "#!/bin/sh\n");
  writeFileSync(join(kernel, ".githooks", "pre-commit"), "#!/bin/sh\n# the kernel's hook\n");
  const target = join(root, "target");
  mkdirSync(join(target, ".githooks"), { recursive: true });
  writeFileSync(join(target, ".githooks", "pre-commit"), "#!/bin/sh\n# THE FOREIGN HOOK — must survive\n");
  const reg = join(root, "projects.json");
  const r = enroll({ kernel, target, id: "t", owner: "o", repo: "r", registryFile: reg });
  expect(r.ok).toBe(true);
  expect(r.backedUp.length).toBe(1);                               // the foreign file was saved
  const bak = r.backedUp[0];
  expect(readFileSync(bak, "utf8")).toContain("THE FOREIGN HOOK");  // its content survives
  expect(readFileSync(join(target, ".githooks", "pre-commit"), "utf8")).toContain("the kernel's hook");
});

test("req9: a re-enroll of an IDENTICAL file makes no spurious .bak", () => {
  const kernel = join(root, "kernel");
  mkdirSync(join(kernel, ".githooks"), { recursive: true });
  writeFileSync(join(kernel, ".githooks", "pre-commit"), "same\n");
  const target = join(root, "target");
  mkdirSync(join(target, ".githooks"), { recursive: true });
  writeFileSync(join(target, ".githooks", "pre-commit"), "same\n");
  const r = enroll({ kernel, target, id: "t", owner: "o", repo: "r", registryFile: join(root, "projects.json") });
  expect(r.backedUp).toEqual([]);
});

// ═══ §6 / SLOP-09: the cycle re-entrancy guard ═══
function rtSlow(delayMs: number): Runtime {
  const s: RuntimeStatus = { ts: "t", tick: 0, daemonOk: true, cursor: 0, prNodes: 0, ready: 0, eligible: 0, planHash: null, planKind: "ok", kicks: 0, errors: [] };
  return { tick: async () => { await Bun.sleep(delayMs); return s; }, start() {}, stop: async () => s, status: () => null, state: { running: false, tick: 0 } };
}

test("SLOP-09: a concurrent cycle is SKIPPED with a LOUD, honest row (never a silent overlap)", async () => {
  const enrolled: Enrolled[] = [{ spec: { id: "a", root, owner: "o", repo: "r", tokenEnv: "T", worktreeRoot: root, store: join(root, "a.sqlite") }, rt: rtSlow(80), ok: true }];
  const cycle = makeCycle(enrolled, root, (() => { let n = 0; return () => ++n; })());
  const first = cycle();                 // in flight for 80 ms
  await cycle();                         // the concurrent call MUST skip
  const a = JSON.parse(readFileSync(statusPath(root), "utf8")) as AggregateStatus;
  expect(a.projects.a.ok).toBe(false);
  expect(a.projects.a.error).toContain("CYCLE-IN-FLIGHT");
  expect(a.failed).toBe(1);              // counted, not hidden
  await first;
});
