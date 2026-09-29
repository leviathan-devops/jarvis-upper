// W9 — the runtime seat's findings, pinned. Found by OPERATING the live daemon, not reading.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { guardrail } from "../src/guardrail";
import { GATE_TO_CONTEXT } from "../src/status-contract";

function freshDb(): Database {
  const db = new Database(":memory:");
  db.run("CREATE TABLE pr_node(id TEXT PRIMARY KEY, state TEXT, head_sha TEXT)");
  db.run("CREATE TABLE gate_pass(id TEXT PRIMARY KEY, pr_node TEXT, gate TEXT, verdict TEXT, head_sha TEXT, at INTEGER)");
  db.run("CREATE TABLE pr_edge(from_pr TEXT, to_pr TEXT, kind TEXT)");
  return db;
}

test("test_guardrail_reads_latest_verdict", () => {
  // FIXED (the runtime seat, H2/H5 — MEASURED LIVE on store.sqlite): gate_pass's PK is a
  // surrogate `id`, so (pr_node, gate) can hold MANY rows. A LEGACY row with `id = NULL`
  // never conflicts under a TEXT PK, so a STALE verdict survived and — because the read
  // had NO ORDER BY — masked the NEWER one. Measured: ci_green held pass(rowid 1, NULL id)
  // + fail(rowid 5, the live mirror) and .get() returned the stale PASS.
  const db = freshDb();
  db.run("INSERT INTO pr_node VALUES('p','ready_to_merge','sha1')");
  for (const g of Object.keys(GATE_TO_CONTEXT)) {
    if (g === "ci_green") continue;        // ci_green is inserted below (the legacy + the newer)
    db.run("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES(?,?,?,?,?,?)",
      [`[\"p\",\"${g}\"]`, "p", g, "pass", "sha1", 100]);
  }
  // the STALE legacy row (id NULL) that used to win the unordered read
  db.run("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES(NULL,'p','ci_green','pass','sha1',100)");
  // the NEWER verdict
  db.run("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES('[\"p\",\"ci_green\"]','p','ci_green','fail','sha1',200)");
  const g = guardrail(db, "p");
  expect(g.ok).toBe(false);                       // the LATEST verdict (fail) wins
  // FIXED (the audit MEDIUM K): a present-but-failed gate reads GATE-FAILED (not GATE-MISSING).
  expect(g.reasons).toContain("GATE-FAILED:ci_green:fail");
});

test("test_gate_pass_dedupe_migration", async () => {
  // FIXED (the runtime seat, H5): the migration dedupes to MAX(rowid) per (pr_node, gate)
  // and adds a UNIQUE index, so a duplicate becomes IMPOSSIBLE.
  const p = `/tmp/w9-store-${Date.now()}.sqlite`;
  const pre = new Database(p);
  pre.run("CREATE TABLE gate_pass(id TEXT PRIMARY KEY, pr_node TEXT, gate TEXT, verdict TEXT, head_sha TEXT, at INTEGER)");
  pre.run("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES(NULL,'p','ci_green','pass','s',100)");
  pre.run("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES('[\"p\",\"ci_green\"]','p','ci_green','fail','s',200)");
  pre.close();
  // open through the store (which applies the migrations)
  const r = Bun.spawnSync(["bun", "-e", "const {openStore}=await import('./src/store.ts'); const db=openStore(process.env.UPPER_STORE); console.log(JSON.stringify(db.query('SELECT COUNT(*) c FROM gate_pass').get())); console.log(JSON.stringify(db.query(\"SELECT name FROM sqlite_master WHERE type='index' AND name='gate_pass_pr_gate'\").get()));"], {
    cwd: import.meta.dir + "/..", env: { ...process.env, UPPER_STORE: p }, stdout: "pipe",
  });
  const out = r.stdout.toString();
  expect(out).toContain('{"c":1}');                                  // deduped to the newest
  expect(out).toContain("gate_pass_pr_gate");                        // the unique index
  await Bun.file(p).delete?.();
});
