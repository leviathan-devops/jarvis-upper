// W8 — the ship-gate medium/low sweep. Every test FAILS before its fix and PASSES after.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { daemonKickDeps } from "../src/kick-adapter";
import { kick } from "../src/kick";
import { dossierSha16 } from "../src/dossier";
import { targetMatchesRemote } from "../src/target-guard";

const repo = (url: string) => () => ({ url, isRepo: true });

// ---- target-guard (W8-6/W8-7) ----

test("test_target_trailing_slash_ok", () => {
  // FIXED (ship-gate LOW): `.../o/r.git/` left "r.git" as the repo segment, so a VALID
  // remote reported TARGET-MISMATCH. Strip trailing slashes before stripping `.git`.
  const r = targetMatchesRemote({ root: "/tmp", owner: "o", repo: "r", readRemote: repo("https://github.com/o/r.git/") });
  expect(r.ok).toBe(true);
});

test("test_target_no_host_refuses", () => {
  // FIXED (ship-gate MEDIUM): the host check was SKIPPED when parsed.host was falsy — a
  // hostless remote failed OPEN past the lookalike-host guard. Fail closed.
  const r = targetMatchesRemote({ root: "/tmp", owner: "o", repo: "r", readRemote: repo("file:///o/r.git") });
  expect(r.ok).toBe(false);
  expect(r.reason ?? "").toContain("TARGET-NO-HOST");
});

// ---- kick-adapter (W8-1/W8-2/W8-3) ----

test("test_spawn_prompt_cap_is_16384", async () => {
  // FIXED (ship-gate MEDIUM): the spawn prompt reused the SEND 4096 cap, needlessly
  // truncating the origin JSON. SpawnSessionRequest.prompt is 16384 (openapi.yaml:11860).
  const calls: { op: string; opts: { body?: { prompt?: string } } }[] = [];
  const callFn = (async (op: string, opts: never) => { calls.push({ op, opts }); return { session: { id: "s" } }; }) as never;
  const deps = daemonKickDeps({ callFn });
  const big = "x".repeat(10000);
  await deps.spawn({ projectId: "p", brief: big, attachments: [] });
  expect(calls[0].opts.body?.prompt?.length).toBe(10000);
});

test("test_spawn_sends_attachments", async () => {
  // FIXED (ship-gate MEDIUM): attachments were SILENTLY DROPPED — the dossier bytes never
  // reached the daemon. AttachmentInput is {data, mimeType} (openapi.yaml:7619).
  const p = `/tmp/w8-attach-${Date.now()}.md`;
  await Bun.write(p, "# dossier\norigin: x\n");
  const calls: { op: string; opts: { body?: { attachments?: { data: string; mimeType: string }[] } } }[] = [];
  const callFn = (async (op: string, opts: never) => { calls.push({ op, opts }); return { session: { id: "s" } }; }) as never;
  const deps = daemonKickDeps({ callFn });
  await deps.spawn({ projectId: "p", brief: "b", attachments: [p] });
  const att = calls[0].opts.body?.attachments;
  expect(att?.length).toBe(1);
  expect(att?.[0].data).toContain("# dossier");
  expect(att?.[0].mimeType).toBe("text/markdown");
  await Bun.file(p).delete?.();
});

test("test_kick_liveness_unknown_refuses", async () => {
  // FIXED (ship-gate MEDIUM): a TRANSPORT failure collapsed to "not alive", so kick()
  // fell through to spawn and created a DUPLICATE session during a transient outage.
  const db = new Database(":memory:");
  db.run("CREATE TABLE bug_record (id TEXT PRIMARY KEY, dossier_path TEXT)");
  db.run("CREATE TABLE kick (id TEXT PRIMARY KEY, bug_record TEXT, mode TEXT, target_session TEXT, spawned_session TEXT, dossier_path TEXT, dossier_sha16 TEXT, sent_at INTEGER, outcome TEXT)");
  db.run("INSERT INTO bug_record (id, dossier_path) VALUES ('B1','/tmp/d')");
  const md = "# dossier\n", oj = "{}";
  const sha = dossierSha16(md, oj);
  let spawned = 0;
  const deps = {
    sessionAlive: async () => "unknown" as const,
    send: async () => ({ ok: true }),
    spawn: async () => { spawned++; return { sessionId: "s" }; },
    openBranch: async () => ({ ok: true }),
    readFile: async (p: string) => p.endsWith("manifest.sha16") ? sha : (p.endsWith("origin.json") ? oj : md),
  };
  let threw = "";
  try {
    await kick(db, deps, { bugId: "B1", projectId: "p", originSession: "s0", originCommit: "c", dossierPath: "/tmp/d" });
  } catch (e) { threw = String(e); }
  expect(threw).toContain("KICK-LIVENESS-UNKNOWN");
  expect(spawned).toBe(0);      // NEVER a duplicate spawn
});

test("test_rail_cap_ceiling_is_clamped", () => {
  // FIXED (ship-gate LOW): NO upper bound — RAIL_MAX_BUF=1000000000 disabled the cap.
  // Measured on the PRODUCTION path (a fresh module load with the env set), never a read.
  const r = Bun.spawnSync(["bun", "-e", "console.log((await import('./src/runtime.ts')).RAIL_MAX_BUF)"], {
    cwd: import.meta.dir + "/..",
    env: { ...process.env, RAIL_MAX_BUF: "1000000000" },
    stdout: "pipe",
  });
  expect(r.stdout.toString().trim()).toBe("4194304");       // the 4 MiB ceiling
});
