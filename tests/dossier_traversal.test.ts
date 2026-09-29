// dossier_traversal.test.ts — the REFUTATION PIN for the ocr round-4 desks.ts
// finding ("bugId is used directly in file paths without a containment check").
//
// ADJUDICATED (both sides):
//   The scanner's claim is that `bugId` reaches a path unvalidated. MEASURED:
//   every writer goes through `dossierDir`, which REFUSES any bugId that is not
//   [A-Za-z0-9_-]+ or that contains ".." — so the traversal cannot be reached.
//   This test pins that: a traversal bugId THROWS INVALID-BUGID (it never
//   becomes a path). If a future change removes the guard, this goes RED.
import { test, expect } from "bun:test";
import { dossierDir, writeDossier } from "../src/dossier";

test("dossier_traversal: a traversal bugId is REFUSED, never a path", () => {
  for (const bad of ["../evil", "a/../../b", "..", "a/b", "a\\b", ""]) {
    expect(() => dossierDir("/tmp/dossiers-root", bad)).toThrow(/INVALID-BUGID/);
  }
});

test("dossier_traversal: a well-formed bugId resolves INSIDE the root", () => {
  const d = dossierDir("/tmp/dossiers-root", "BUG-42");
  expect(d.startsWith("/tmp/dossiers-root/dossiers/")).toBe(true);
  expect(d.includes("..")).toBe(false);
});

test("dossier_traversal: writeDossier cannot escape the root via bugId", async () => {
  await expect(
    writeDossier("/tmp/dossiers-root", "../../etc/evil", "# x\n", {}),
  ).rejects.toThrow(/INVALID-BUGID/);
});
