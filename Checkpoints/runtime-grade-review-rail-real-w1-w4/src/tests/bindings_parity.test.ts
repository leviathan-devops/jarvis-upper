// W0 gate: bindings parity 144/144/269 — route names generated, counts pinned.
import { test, expect } from "bun:test";
import { ROUTES } from "../ao-client/gen/routes";
import pin from "../ao-client/pin.json";

test("bindings_parity: generated route count matches pinned openapi", () => {
  expect(ROUTES.length).toBe(164);
  expect(pin.paths).toBe(144);
  expect(pin.ops).toBe(164);
  expect(pin.schemas).toBe(269);
});

test("bindings_parity: control + git + event ops present by id", () => {
  const ids = new Set(ROUTES.map((r) => r.id));
  for (const need of [
    "spawnSession", "sendSessionMessage", "steerOrSendSessionConversationTurn",
    "killSession", "delegateTask", "mergePR", "claimSessionPR",
    "streamEvents", "listProjects",
  ]) expect(ids.has(need)).toBe(true);
});
