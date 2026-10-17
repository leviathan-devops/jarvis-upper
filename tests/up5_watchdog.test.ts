// UP-5: ready 0 + errors, and an IDLE/empty plan, are UNHEALTHY. Never OK.
import { test, expect } from "bun:test";
import { classifyWatchdog } from "../src/watchdog";

// sha256("") first 16 hex chars — the empty-plan hash.
const EMPTY_PLAN_HASH = "e3b0c44298fc1c14";
const REAL_PLAN_HASH = "aaaaaaaaaaaaaaaa";

test("UP-5: ready 0 + errors is UNHEALTHY, never OK", () => {
  const report = classifyWatchdog({
    ready: 0,
    errors: ["ECONNREFUSED"],
    planKind: "ok",
    planHash: REAL_PLAN_HASH,
  });
  expect(report.verdict).toBe("UNHEALTHY");
  expect(report.reasons).toContain("READY-0-WITH-ERRORS");
});

test("UP-5: an IDLE plan is UNHEALTHY, never OK", () => {
  const report = classifyWatchdog({
    ready: 3,
    errors: [],
    planKind: "none",
    planHash: EMPTY_PLAN_HASH,
  });
  expect(report.verdict).toBe("UNHEALTHY");
  expect(report.reasons).toContain("IDLE-OR-EMPTY-PLAN");
});

test("UP-5: an empty plan is UNHEALTHY, never OK", () => {
  const report = classifyWatchdog({
    ready: 0,
    errors: [],
    planKind: "ok",
    planHash: EMPTY_PLAN_HASH,
  });
  expect(report.verdict).toBe("UNHEALTHY");
  expect(report.reasons).toContain("IDLE-OR-EMPTY-PLAN");
});

test("UP-5: a non-empty plan with ready work and no errors is OK", () => {
  const report = classifyWatchdog({
    ready: 2,
    errors: [],
    planKind: "ok",
    planHash: REAL_PLAN_HASH,
  });
  expect(report.verdict).toBe("OK");
  expect(report.reasons).toEqual([]);
});
