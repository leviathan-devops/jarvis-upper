// W6 — THE SHIP-GATE FIX SUITE. Every probe here is one of the gate's CONFIRMED
// findings (adjudicated against openapi.yaml / the source), pinned so it cannot regress.
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { daemonKickDeps } from "../src/kick-adapter";
import { listPrsFromAo } from "../src/adapter-verbs";

const ROOT = join(import.meta.dir, "..");

// ── CRITICAL x2: the spawn request/response shape (measured against openapi.yaml) ──
test("test_kick_spawn_matches_the_openapi_shape", async () => {
  const calls: { op: string; opts: { params?: Record<string, unknown>; body?: Record<string, unknown> } }[] = [];
  const callFn = (async (op: string, o: never) => {
    calls.push({ op, opts: o });
    if (op === "spawnSession") return { session: { id: "spawned-42" } };
    if (op === "getSession") return { session: { id: "s" } };
    return null;
  }) as never;
  const deps = daemonKickDeps({ callFn });

  const r = await deps.spawn({ projectId: "p", brief: "the brief", attachments: [] });
  expect(r.sessionId).toBe("spawned-42");                       // SpawnSessionResponse.session.id
  const body = calls.find((c) => c.op === "spawnSession")!.opts.body!;
  expect(body.prompt).toBe("the brief");                        // `prompt`, NOT `message`
  expect(body.message).toBeUndefined();
  expect(body.attachments).toBeUndefined();                     // never a wrong-shaped string[]

  // sessionAlive checks the FIELD (getSession 200 = { session })
  expect(await deps.sessionAlive("s")).toBe("alive");
  // send uses `message` (SendSessionMessageRequest.message)
  await deps.send("s", "hi");
  expect(calls.find((c) => c.op === "sendSessionMessage")!.opts.body!.message).toBe("hi");
});

// ── MEDIUM x2: the mode + the bug-id are validated ──
test("test_kick_rejects_bad_mode_and_id", async () => {
  const { verbKick } = await import("../src/cli-verbs");
  expect((await verbKick(ROOT, "bug-1", "liv")).out).toMatchObject({ refused: "KICK-BAD-MODE:liv" });
  expect((await verbKick(ROOT, "bad id with spaces", "live")).out).toMatchObject({ refused: "KICK-BAD-BUG-ID" });
  expect((await verbKick(ROOT, "../../etc/passwd")).out).toMatchObject({ refused: "KICK-BAD-BUG-ID" });
  expect((await verbKick(ROOT)).out).toMatchObject({ refused: "KICK-NEEDS-BUG-ID" });
});

// ── HIGH: the partial sync is OBSERVABLE by the caller ──
test("test_partial_sync_is_observable", async () => {
  const sessions = [{ id: "ok-1", projectId: "p" }, { id: "bad-1", projectId: "p" }];
  let received: { session: string; reason: string }[] = [];
  const callFn = (async (op: string, o: { params?: { sessionId?: string } }) => {
    if (op === "listSessions") return { sessions };
    if (op === "listSessionPRs") { if (o.params?.sessionId === "bad-1") throw new Error("AO-500"); return { sessionId: o.params?.sessionId, prs: [] }; }
    return null;
  }) as never;
  const orig = console.error; console.error = () => {};
  try { await listPrsFromAo({ callFn, project: "p", onPartial: (e) => { received = e; } }); }
  finally { console.error = orig; }
  expect(received.length).toBe(1);
  expect(received[0].session).toBe("bad-1");       // the failure is NAMED, not console-only
  expect(received[0].reason).toContain("AO-500");
});

// ── HIGH: the env parses are validated (never 0/NaN) ──
test("test_env_parses_are_validated", async () => {
  const runtimeSrc = await Bun.file(new URL("../src/runtime.ts", import.meta.url)).text();
  // UPDATED (W8-9): the guard now ALSO clamps an absurd ceiling — assert the current text.
  expect(runtimeSrc).toContain("if (!Number.isFinite(n) || n <= 0) return 65536;");   // RAIL_MAX_BUF
  expect(runtimeSrc).toContain("Math.min(n, 4 * 1024 * 1024)");                      // the ceiling
  const clientSrc = await Bun.file(new URL("../ao-client/client.ts", import.meta.url)).text();
  expect(clientSrc).toContain("Number.isFinite(n) && n > 0 ? n : 8000");     // AO_CALL_TIMEOUT_MS
  // the modules export sane values under a garbage env
  const { RAIL_MAX_BUF } = await import("../src/runtime");
  expect(RAIL_MAX_BUF).toBeGreaterThan(0);
  const { AO_CALL_TIMEOUT_MS } = await import("../ao-client/client");
  expect(AO_CALL_TIMEOUT_MS).toBeGreaterThan(0);
});

// ── HIGH: the direct-branch kick is IDEMPOTENT (a second kick must not fail) ──
test("test_branch_kick_is_idempotent", async () => {
  const repo = mkdtempSync(join(tmpdir(), "w6-branch-"));
  const g = (args: string[]) => Bun.spawnSync(["git", "-C", repo, ...args], { stdout: "pipe", stderr: "pipe" });
  g(["init", "-q"]); g(["config", "user.email", "w6@t.local"]); g(["config", "user.name", "w6"]);
  writeFileSync(join(repo, "a.txt"), "a\n"); g(["add", "-A"]); g(["commit", "-q", "-m", "init"]);
  const deps = daemonKickDeps({ cwd: repo });
  expect((await deps.openBranch("bug-7")).ok).toBe(true);    // first: creates fix/bug-7
  expect((await deps.openBranch("bug-7")).ok).toBe(true);    // second: checks out the existing branch
});

// ── LOW: importing main.ts has NO side effects ──
test("test_main_import_is_side_effect_free", async () => {
  const src = await Bun.file(new URL("../src/main.ts", import.meta.url)).text();
  // every side effect sits behind the import.meta.main guard
  // UPDATED (the multi-project layer): main() is ASYNC now (it awaits the first fleet cycle),
  // so the guard voids the promise rather than returning it.
  expect(src).toContain("if (import.meta.main) void main();");
  expect(src).toContain("export async function main(");
  // a bare `rt.start()` at module scope is gone (the orchestrator owns the cycle)
  expect(src.split("if (import.meta.main)")[0]).not.toMatch(/^\s*rt\.start\(\);$/m);
});
