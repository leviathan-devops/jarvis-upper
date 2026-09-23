// W1 gate: synthetic 500-event replay dupes=0 gaps=0; adversarial first.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { EventRail } from "../ao-client/rail";
import { openStore } from "../src/store";
import { reduceEvent } from "../src/reducers";

const frame = (seq: number, type = "session_updated") =>
  `id: ${seq}\nevent: ${type}\ndata: {"seq":${seq},"projectId":"p","sessionId":"s","type":"${type}","payload":{}}\n\n`;

function memStore(): Database {
  const db = openStore(":memory:");
  db.exec("DELETE FROM rail_seq;");
  return db;
}

function fiveHundred(): string[] {
  const parts: string[] = [];
  for (let n = 1; n <= 500; n++) parts.push(frame(n));
  return parts;
}

test("replay_converges: ordered 500 replay dupes=0 gaps=0", async () => {
  const db = memStore();
  const rail = new EventRail(db);
  const seen: number[] = [];
  const stats = await rail.attach(fiveHundred(), (ev) => { seen.push(ev.seq); });
  expect(stats.frames).toBe(500);
  expect(stats.processed).toBe(500);
  expect(stats.dupes).toBe(0);
  expect(stats.gaps).toBe(0);
  expect(stats.cursor).toBe(500);
  expect(seen.length).toBe(500);
  expect(rail.getCursor()).toBe(500);
  db.close();
});

test("replay_converges: duplicated replay advances cursor zero new", async () => {
  const db = memStore();
  const rail = new EventRail(db);
  await rail.attach(fiveHundred(), () => {});
  const replay = new EventRail(db);
  const seen: number[] = [];
  const stats = await replay.attach(fiveHundred(), (ev) => { seen.push(ev.seq); });
  expect(stats.frames).toBe(500);
  expect(stats.processed).toBe(0);
  expect(stats.dupes).toBe(500);
  expect(seen.length).toBe(0);
  db.close();
});

test("replay_converges: kill-9 mid-stream restarts converge via cursor", async () => {
  // container angle: producer dies at frame 300, process restarts,
  // resumes from persisted cursor with an overlapping tail (280..500).
  const db = memStore();
  const seen = new Set<number>();
  const r1 = new EventRail(db);
  const s1 = await r1.attach(fiveHundred().slice(0, 300), (ev) => { seen.add(ev.seq); });
  expect(s1.processed).toBe(300);
  expect(s1.cursor).toBe(300);
  const r2 = new EventRail(db); // fresh process, same persisted store
  expect(r2.getCursor()).toBe(300);
  const tail = fiveHundred().slice(279); // frames 280..500 (21-frame overlap)
  const s2 = await r2.attach(tail, (ev) => { seen.add(ev.seq); });
  expect(s2.processed).toBe(200);
  expect(s2.dupes).toBe(21); // 280..300 inclusive = 21 dupes
  expect(s2.gaps).toBe(0);
  expect(seen.size).toBe(500);
  expect(r2.getCursor()).toBe(500);
  db.close();
});


test("replay_converges: reducer is idempotent across double-replay", async () => {
  const db = memStore();
  const rail = new EventRail(db);
  const ev = { seq: 1, type: "pr_state_changed", data: { pr: { number: 7, session_id: "s-1", state: "open", head_sha: "a" }, projectId: "p" } };
  expect(reduceEvent(db, ev)).toBe("applied");
  expect(reduceEvent(db, ev)).toBe("applied");
  const rows = db.query("SELECT COUNT(*) AS n FROM pr_node").get() as { n: number };
  expect(rows.n).toBe(1);
  db.close();
});
