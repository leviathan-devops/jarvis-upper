// W5 — THE RESTART SUITE: the daemon's place is PERSISTED, so a restart resumes and
// never rewinds. The cursor lives in the `rail_seq` table (source='ao-events'), so a
// fresh runtime on the SAME store must read the CURRENT cursor, not a stale one.
import { test, expect } from "bun:test";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime } from "../src/runtime";
import { openStore } from "../src/store";

test("test_daemon_advances_after_restart", async () => {
  const root = mkdtempSync(join(tmpdir(), "w5-restart-"));
  const dbPath = join(root, "store.sqlite");
  const deps = { probe: async () => false, tickMs: 999999 };

  // run 1: the persisted cursor is 42; a tick reads it
  const db1 = openStore(dbPath);
  db1.query("INSERT OR REPLACE INTO rail_seq(source, last_seq, updated_at) VALUES ('ao-events', 42, 0)").run();
  const rt1 = createRuntime({ root, db: db1, deps });
  const s1 = await rt1.tick();
  expect(s1.cursor).toBe(42);
  expect(existsSync(join(root, "runtime/status.json"))).toBe(true);
  await rt1.stop();
  db1.close();

  // the rail advances while the process is DOWN (the persisted cursor is the daemon's place)
  const dbx = openStore(dbPath);
  dbx.query("UPDATE rail_seq SET last_seq = 99 WHERE source='ao-events'").run();
  dbx.close();

  // RESTART: a fresh runtime on the SAME root+store picks up the NEW cursor
  const db2 = openStore(dbPath);
  const rt2 = createRuntime({ root, db: db2, deps });
  const s2 = await rt2.tick();
  expect(s2.cursor).toBe(99);          // ADVANCED from the store, never rewound to 42
  expect(s2.tick).toBe(1);             // the in-memory counter restarts (documented)
  await rt2.stop();
  db2.close();
});
