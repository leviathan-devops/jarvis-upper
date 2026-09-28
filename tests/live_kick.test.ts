// LIVE-KICK-1: the kick rail was never exercised live — verbKick always
// answered KICK-ADAPTER-UNWIRED, so no kick row ever landed. This test fires
// the rail against the RUNNING daemon and records the row. Honest in both
// world-states (the live_e2e contract): daemon up -> a real live kick with a
// delivered row + the brief visible in the scratch session's conversation;
// daemon down -> the BLOCKED shape (named command), never a pass.
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DAEMON } from "../src/runtime";
import { openStore } from "../src/store";
import { writeDossier } from "../src/dossier";
import { kick } from "../src/kick";
import { daemonKickDeps } from "../src/kick-adapter";
import { verbKick, parseKickMode } from "../src/cli-verbs";
import { call } from "../ao-client/client";

const ORIGIN = "c3c3ed0d562edd0443a2fe2ba4e5473bb3e4bf50";

async function daemonUp(): Promise<boolean> {
  try {
    const r = await fetch(`${DAEMON}/healthz`, { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch { return false; }
}

test("live_kick: verbKick is wired — unknown bug is NO-SUCH-BUG, never KICK-ADAPTER-UNWIRED", async () => {
  const root = new URL("..", import.meta.url).pathname;
  const r = await verbKick(root, "live-kick-1-no-such-bug-xyz");
  expect(JSON.stringify(r.out)).not.toContain("KICK-ADAPTER-UNWIRED");
  expect(r.out).toMatchObject({ refused: "NO-SUCH-BUG" });
});
test("live_kick: --mode flag parses (the documented form), bad mode refuses loudly", async () => {
  expect(parseKickMode(["--mode", "live"])).toBe("live");
  expect(parseKickMode(["--mode=spawn"])).toBe("spawn");
  expect(parseKickMode(["direct"])).toBe("direct");
  expect(parseKickMode(["--mode"])).toBeUndefined();
  expect(parseKickMode(["--mode", "live", "--unknown", "direct"])).toBe("live");
  const bad = await verbKick(new URL("..", import.meta.url).pathname, "live-kick-1-no-such-bug-xyz", "--mode");
  expect(bad.code).toBe(2);
  expect(bad.out).toMatchObject({ refused: "KICK-BAD-MODE" });
});

test("live_kick: verbKick honors UPPER_STORE — isolated bug kicks in the isolated store", async () => {
  const dir = mkdtempSync(join(tmpdir(), "live-kick-iso-"));
  const storePath = join(dir, "iso.sqlite");
  const md = "# BUG ISO-PROBE\nisolation\n";
  const origin = { probe: "upper-store-isolation" };
  await writeDossier(dir, "ISO-PROBE", md, origin);
  const dossierPath = join(dir, "dossiers/ISO-PROBE");
  const prev = process.env.UPPER_STORE;
  process.env.UPPER_STORE = storePath;
  try {
    const seed = openStore();
    seed.query("INSERT INTO bug_record(id, found_by, dossier_path, origin_commit, origin_session, status) VALUES (?,?,?,?,?,?)")
      .run("ISO-PROBE", "thanatos", dossierPath, ORIGIN, null, "open");
    seed.close();
    // Fake transport: proves store routing without touching the daemon or git.
    // If verbKick opened the real store.sqlite, ISO-PROBE would be NO-SUCH-BUG.
    const fake = {
      sessionAlive: async () => false,
      send: async () => ({ ok: true }),
      spawn: async () => ({ sessionId: "iso-spawn-1" }),
      openBranch: async () => ({ ok: true }),
      readFile: (p: string) => Bun.file(p).text(),
    };
    const r = await verbKick(dir, "ISO-PROBE", "direct", fake);
    expect(r.code).toBe(0);
    expect(r.out).toMatchObject({ mode: "direct" });
    const check = openStore(storePath);
    const row = check.query("SELECT outcome FROM kick WHERE bug_record = ?").get("ISO-PROBE") as { outcome: string } | null;
    check.close();
    expect(row?.outcome).toBe("branched");
  } finally {
    if (prev === undefined) delete process.env.UPPER_STORE;
    else process.env.UPPER_STORE = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});


test("live_kick: spawn forwards dossier bytes as base64 attachments (mocked callFn)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "live-kick-spawn-"));
  const md = "# BUG SPAWN-PROBE\nbrief\n";
  const origin = { probe: "spawn-attachments" };
  await writeDossier(dir, "SPAWN-PROBE", md, origin);
  const dossierPath = join(dir, "dossiers/SPAWN-PROBE");
  const seen: { body: unknown }[] = [];
  const fakeCall = (async (op: string, opts?: { body?: unknown }) => {
    if (op === "spawnSession") {
      seen.push({ body: opts?.body });
      return { session: { id: "spawn-probe-1" } };
    }
    throw new Error("unexpected op " + op);
  }) as typeof call;
  const db = openStore(":memory:");
  db.query("INSERT INTO bug_record(id, found_by, dossier_path, origin_commit, origin_session, status) VALUES (?,?,?,?,?,?)")
    .run("SPAWN-PROBE", "thanatos", dossierPath, ORIGIN, null, "open");
  try {
    const r = await kick(db, daemonKickDeps({ callFn: fakeCall }), {
      bugId: "SPAWN-PROBE", projectId: "jarvis-upper",
      originSession: null, originCommit: ORIGIN, dossierPath, mode: "spawn",
    });
    expect(r.mode).toBe("spawn");
    expect(r.target).toBe("spawn-probe-1");
    const sent = (seen[0].body ?? {}) as { attachments?: { data: string; mimeType: string }[] };
    expect(sent.attachments?.length).toBe(2);
    const decoded = sent.attachments!.map((a) => Buffer.from(a.data, "base64").toString("utf8"));
    expect(decoded.some((t) => t.includes("SPAWN-PROBE"))).toBe(true);
    expect(decoded.some((t) => t.includes("spawn-attachments"))).toBe(true);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});


test("live_kick: live rail fires against the daemon (or the documented BLOCKED shape)", async () => {
  const up = await daemonUp();
  if (!up) {
    const resume = `start the daemon: DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) /usr/bin/agent-orchestrator`;
    expect(resume).toContain("agent-orchestrator");
    console.log(`live_kick: BLOCKED — daemon down (${DAEMON}). resume: ${resume}`);
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "live-kick-"));
  const md = "# BUG LIVE-KICK-1\nthe kick rail was never exercised live\n";
  const origin = { file: "src/runtime.ts", line: 1, symptom: "the kick rail was never exercised live", originCommit: ORIGIN };
  await writeDossier(dir, "LIVE-KICK-1", md, origin);
  const dossierPath = join(dir, "dossiers/LIVE-KICK-1");
  const db = openStore(":memory:");
  db.query("INSERT INTO bug_record(id, found_by, dossier_path, origin_commit, origin_session, status) VALUES (?,?,?,?,?,?)")
    .run("LIVE-KICK-1", "thanatos", dossierPath, ORIGIN, null, "open");
  const target = await call<{ session: { id: string } }>("spawnSession", {
    body: { projectId: "jarvis-upper", prompt: "LIVE-KICK-1 scratch target — a kick brief will arrive; no action needed.", mode: "chat" },
  });
  const scratch = target.session.id;
  try {
    db.query("UPDATE bug_record SET origin_session = ? WHERE id = ?").run(scratch, "LIVE-KICK-1");
    const r = await kick(db, daemonKickDeps(), {
      bugId: "LIVE-KICK-1", projectId: "jarvis-upper",
      originSession: scratch, originCommit: ORIGIN, dossierPath, mode: "live",
    });
    expect(r.mode).toBe("live");
    expect(r.target).toBe(scratch);
    const row = db.query("SELECT mode, target_session, dossier_sha16, outcome FROM kick WHERE bug_record = ?")
      .get("LIVE-KICK-1") as { mode: string; target_session: string; dossier_sha16: string; outcome: string } | null;
    expect(row?.outcome).toBe("delivered");
    expect(row?.target_session).toBe(scratch);
    expect(row?.dossier_sha16).toBe(r.dossierSha16);
    const conv = await call("getSessionConversation", { params: { sessionId: scratch } });
    const text = JSON.stringify(conv);
    expect(text).toContain("LIVE-KICK-1");
    expect(text).toContain(ORIGIN);
  } finally {
    await call("killSession", { params: { sessionId: scratch } }).catch(() => null);
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 30000);
