// UP-2: the status schema freezes planHash as a 16-hex string. Never null.
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { createRuntime } from "../src/runtime";
import { openStore } from "../src/store";
import { assertStatusSchema, readStatus, STATUS_SCHEMA, statusPath } from "../src/status";

const HASH = /^[0-9a-f]{16}$/;

function cycleDb(): Database {
  const db = openStore(":memory:");
  const node = (id: string) =>
    db.query("INSERT INTO pr_node(id, project, pr_number, session_id, state) VALUES (?, 'p', 1, 's', 'ready_to_merge')").run(id);
  const edge = (f: string, t: string) =>
    db.query("INSERT INTO pr_edge(id, from_pr, to_pr, kind, created_at) VALUES (?,?,?,'depends_on',0)").run(`${f}>${t}`, f, t);
  node("x"); node("y"); node("z");
  edge("x", "y"); edge("y", "z"); edge("z", "x");
  return db;
}

test("UP-2: schema freezes planHash non-null and rejects a planted null", () => {
  expect(STATUS_SCHEMA.planHash.nullable).toBe(false);
  expect(STATUS_SCHEMA.planHash.type).toBe("string");
  expect(() => assertStatusSchema({ planHash: null })).toThrow(/planHash/);
  expect(() => assertStatusSchema({ planHash: undefined })).toThrow(/planHash/);
  expect(() => assertStatusSchema({ planHash: "deadbeef" })).toThrow(/planHash/);
});

test("UP-2: a cycle tick writes a 16-hex planHash, never null", async () => {
  const root = mkdtempSync(join(tmpdir(), "up2-cycle-"));
  const db = cycleDb();
  const rt = createRuntime({
    root,
    db,
    deps: {
      probe: async () => true,
      listPrs: async () => [],
      rails: async () => ({ frames: 1, bytes: 10, lastSeq: 1 }),
    },
  });
  try {
    const s = await rt.tick();
    expect(s.planKind).toBe("cycle");
    expect(s.planHash).toMatch(HASH);
    const disk = JSON.parse(readFileSync(statusPath(root), "utf8")) as { planHash: unknown };
    expect(disk.planHash).toMatch(HASH);
    expect(readStatus(root)?.planHash).toMatch(HASH);
  } finally {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("UP-2: stop() after a failed tick still emits a 16-hex planHash", async () => {
  const root = mkdtempSync(join(tmpdir(), "up2-stop-"));
  const db = openStore(":memory:");
  const rt = createRuntime({
    root,
    db,
    deps: {
      probe: async () => { throw new Error("tick-boom"); },
      listPrs: async () => [],
      rails: async () => ({ frames: 0, bytes: 0, lastSeq: 0 }),
    },
  });
  try {
    rt.start();
    await new Promise((r) => setTimeout(r, 40));
    const s = await rt.stop();
    expect(s.planHash).toMatch(HASH);
    expect(s.planKind).toBe("none");
  } finally {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
