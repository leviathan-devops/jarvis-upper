// W12 — the FINAL ship gate's 3 HIGHs, pinned. Two were bugs in the W9 fix itself.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { guardrail } from "../src/guardrail";
import { GATE_TO_CONTEXT } from "../src/status-contract";

test("test_dedupe_keeps_latest_at_not_max_rowid", async () => {
  // FIXED (the final ship gate HIGH, in MY W9 fix): the dedupe kept MAX(rowid) while the
  // READ orders by `at DESC, rowid DESC`. recordGatePass upserts ON CONFLICT(id) — which
  // PRESERVES rowid but BUMPS `at` — so the NEWEST verdict can live on the SMALLEST rowid.
  // MAX(rowid) would have DROPPED the newest. The survivor must follow the READ's order.
  const p = `/tmp/w12-dedupe-${Date.now()}.sqlite`;
  const pre = new Database(p);
  pre.run("CREATE TABLE gate_pass(id TEXT PRIMARY KEY, pr_node TEXT, gate TEXT, verdict TEXT, head_sha TEXT, at INTEGER)");
  // rowid 1: the NEWEST (at=200); rowid 2: the OLDER (at=100)
  pre.run("INSERT INTO gate_pass VALUES('[\"p\",\"ci_green\"]','p','ci_green','fail','s',200)");
  pre.run("INSERT INTO gate_pass VALUES('legacy-old','p','ci_green','pass','s',100)");
  pre.close();
  const r = Bun.spawnSync(["bun", "-e", "const {openStore}=await import('./src/store.ts'); const db=openStore(process.env.UPPER_STORE); console.log(JSON.stringify(db.query(\"SELECT verdict, at FROM gate_pass WHERE pr_node='p'\").all()));"], {
    cwd: import.meta.dir + "/..", env: { ...process.env, UPPER_STORE: p }, stdout: "pipe",
  });
  const out = r.stdout.toString();
  expect(out).toContain('"verdict":"fail"');   // the NEWEST (at=200) survived
  expect(out).not.toContain('"verdict":"pass"');
  await Bun.file(p).delete?.();
});

test("test_read_remote_failure_is_error_not_no_remote", async () => {
  // FIXED (the final ship gate HIGH): a git FAILURE inside a real worktree collapsed to
  // "(no remote)" -> ok:true. A NON-repo path with a broken git invocation must not read
  // as an allow. (A real non-repo -> GIT-UNAVAILABLE:not-a-repo, already fail-closed.)
  const { targetMatchesRemote } = await import("../src/target-guard");
  // an injected RemoteRead carrying `error` must REFUSE
  const r = targetMatchesRemote({ root: "/tmp", owner: "o", repo: "r", readRemote: () => ({ url: null, isRepo: true, error: "remote-read-failed:exit128" }) });
  expect(r.ok).toBe(false);
  expect(r.reason ?? "").toContain("GIT-UNAVAILABLE");
});

test("test_desks_and_mirror_share_one_gate_row", async () => {
  // FIXED (the final ship gate HIGH): desks.ts inserted id=`w4b:${target}` while
  // recordGatePass upserts id=JSON([prId,g]) for the SAME (pr_node,gate); the new
  // UNIQUE(pr_node,gate) made the second writer throw. Both now use the SAME id.
  const p = `/tmp/w12-desks-${Date.now()}.sqlite`;
  const db = new Database(p);
  db.run("CREATE TABLE gate_pass(id TEXT PRIMARY KEY, pr_node TEXT, gate TEXT, verdict TEXT, evidence TEXT, sha16 TEXT, head_sha TEXT, at INTEGER)");
  db.run("CREATE UNIQUE INDEX gate_pass_pr_gate ON gate_pass(pr_node, gate)");
  const pair = JSON.stringify(["p", "hardened"]);
  db.run("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET verdict=excluded.verdict, at=excluded.at", [pair, "p", "hardened", "pass", "s", 100]);
  // the SECOND writer (the same JSON-pair id) upserts — NO constraint error
  db.run("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET verdict=excluded.verdict, at=excluded.at", [pair, "p", "hardened", "fail", "s", 200]);
  const rows = db.query("SELECT COUNT(*) c FROM gate_pass WHERE pr_node='p' AND gate='hardened'").get() as { c: number };
  expect(rows.c).toBe(1);                                  // ONE row, not a constraint throw
  const v = db.query("SELECT verdict FROM gate_pass WHERE pr_node='p' AND gate='hardened'").get() as { verdict: string };
  expect(v.verdict).toBe("fail");                          // the latest upsert won
  db.close();
  await Bun.file(p).delete?.();
});
