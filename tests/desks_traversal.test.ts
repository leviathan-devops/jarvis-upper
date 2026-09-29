// desks_traversal.test.ts — the pin for the ocr round-4 rescan-4 finding
// ("target is interpolated into a path unvalidated"). A traversal target must
// THROW before any path is built; a well-formed target proceeds.
import { test, expect } from "bun:test";
import { openStore } from "../src/store";
import { waveA } from "../src/desks";

test("desks_traversal: a traversal target is REFUSED", async () => {
  const db = openStore(":memory:");
  for (const bad of ["../evil", "a/b", "..", "a\\b", ""]) {
    await expect(waveA(db, { root: "/tmp/fx" }, bad)).rejects.toThrow(/INVALID-TARGET/);
  }
  db.close();
});
