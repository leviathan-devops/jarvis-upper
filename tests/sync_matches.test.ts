// W1 gate: rows==API counts — every listed PR lands exactly once.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { openStore } from "../src/store";
import { syncPrs, type PrRow } from "../src/sync";

test("sync_matches: listed rows all land; second sync is idempotent", async () => {
  const db = openStore(":memory:");
  const mk = (n: number): PrRow => ({
    project: "p", pr_number: n, session_id: "s", head_sha: `h${n}`, state: "open",
  });
  const first = await syncPrs(db, async () => [mk(1), mk(2), mk(3)]);
  expect(first.rows).toBe(3);
  const second = await syncPrs(db, async () => [mk(1), mk(2), mk(3), mk(4)]);
  expect(second.rows).toBe(4);
  const total = db.query("SELECT COUNT(*) AS n FROM pr_node").get() as { n: number };
  expect(total.n).toBe(4);
  db.close();
});
