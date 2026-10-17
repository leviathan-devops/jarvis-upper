// UP-4: a stuck cycle cannot stay in flight longer than 1 minute.
// The clock is fake. 60_000 is the bar (1 minute), not a tunable.
import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime } from "../src/runtime";
import { openStore } from "../src/store";

const ONE_MINUTE_MS = 60_000;

interface FakeTimer {
  at: number;
  fn: () => void;
  dead: boolean;
}

test("UP-4: stuck cycle has 0 in-flight streaks longer than 1 minute", async () => {
  const root = mkdtempSync(join(tmpdir(), "up4-stuck-"));
  const db = openStore(":memory:");
  let nowMs = 0;
  const timers: FakeTimer[] = [];
  const schedule = (fn: () => void, delayMs: number) => {
    const timer: FakeTimer = { at: nowMs + delayMs, fn, dead: false };
    timers.push(timer);
    return { cancel() { timer.dead = true; } };
  };
  const advance = (ms: number): void => {
    const target = nowMs + ms;
    for (;;) {
      const due = timers
        .filter((t) => !t.dead && t.at <= target)
        .sort((a, b) => a.at - b.at);
      const next = due[0];
      if (!next) break;
      nowMs = next.at;
      next.dead = true;
      next.fn();
    }
    nowMs = target;
  };
  const rt = createRuntime({
    root,
    db,
    deps: {
      now: () => new Date(nowMs),
      schedule,
      tickMs: 1_000_000_000,
      probe: () => new Promise(() => {}),
      listPrs: async () => [],
      rails: async () => ({ frames: 0, bytes: 0, lastSeq: 0 }),
    },
  });
  try {
    rt.start();
    advance(90_000);
    const streaks = rt.inFlightStreaks();
    const tooLong = streaks.filter((s) => s.durationMs > ONE_MINUTE_MS);
    expect(tooLong).toEqual([]);
    expect(streaks.length).toBeGreaterThan(0);
    expect(rt.state.inFlight).toBe(false);
  } finally {
    const stopping = rt.stop();
    advance(ONE_MINUTE_MS);
    await stopping;
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
