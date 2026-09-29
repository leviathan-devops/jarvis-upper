import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { defaultRails } from "../../src/runtime";
test("defaultRails_uses_cursor", async () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE rail_seq (source TEXT PRIMARY KEY, last_seq INTEGER NOT NULL, updated_at TEXT)");
  db.query("INSERT INTO rail_seq (source,last_seq,updated_at) VALUES ('ao-events',4242,'x')").run();
  const urls: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (u: any) => { urls.push(String(u)); return new Response("", { status: 200 }); }) as any;
  try { await defaultRails(db, "/tmp"); } finally { globalThis.fetch = orig; }
  expect(urls.length).toBe(1);
  expect(urls[0]).toContain("after=4242");   // the cursor, NOT after=0
  expect(urls[0]).not.toContain("after=0");
});
