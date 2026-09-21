// W3 gate: known-commit hit + ambiguous lands triage (confidence floor 0.6).
import { test, expect } from "bun:test";
import { $ } from "bun";
import { openStore } from "../src/store";
import { attributeBug, CONFIDENCE_FLOOR } from "../src/attribute";

async function repo(): Promise<string> {
  const dir = await $`mktemp -d`.text().then((s) => s.trim());
  await $`git init -q ${dir}`.quiet();
  await $`git -C ${dir} config user.email t@t`.quiet();
  await $`git -C ${dir} config user.name t`.quiet();
  return dir;
}
async function commit(dir: string, file: string, content: string, msg: string): Promise<string> {
  await Bun.write(`${dir}/${file}`, content);
  await $`git -C ${dir} add ${file}`.quiet();
  await $`git -C ${dir} commit -qm ${msg}`.quiet();
  return (await $`git -C ${dir} rev-parse HEAD`.text()).trim();
}

test("attribution_triage: single-author bug commit hits with confidence", async () => {
  const dir = await repo();
  await commit(dir, "f.txt", "line one\n", "first");
  const bug = await commit(dir, "f.txt", "line one\nline two BUG\n", "second adds bug");
  const db = openStore(":memory:");
  const a = await attributeBug(db,
    { repo: dir, files: ["f.txt"], lines: { "f.txt": [2] } },
    async () => ({ session: "s-9", worker: "w-9" }));
  expect(a.commit).toBe(bug);
  expect(a.confidence).toBeGreaterThanOrEqual(CONFIDENCE_FLOOR);
  expect(a.session).toBe("s-9");
  expect(a.candidates.length).toBeGreaterThanOrEqual(1);
  db.close();
  await $`rm -rf ${dir}`.quiet();
});

test("attribution_triage: empty history lands no-candidates (triage)", async () => {
  const dir = await repo();
  await $`touch ${dir}/empty.txt && git -C ${dir} add empty.txt && git -C ${dir} commit -qm seed`.quiet();
  const db = openStore(":memory:");
  const a = await attributeBug(db,
    { repo: dir, files: ["missing.txt"] },
    async () => ({ session: null, worker: null }));
  expect(a.confidence).toBe(0);
  expect(a.session).toBeNull();
  db.close();
  await $`rm -rf ${dir}`.quiet();
});

test("attribution_triage: branch-side commit scores below blame-exact (no overclaim)", async () => {
  const dir = await repo();
  await commit(dir, "f.txt", "a\n", "base");
  await $`git -C ${dir} checkout -qb side`.quiet();
  await commit(dir, "f.txt", "a\nside\n", "side work");
  await $`git -C ${dir} checkout -q master 2>/dev/null || git -C ${dir} checkout -q main`.quiet();
  await commit(dir, "g.txt", "main\n", "main work");
  await $`git -C ${dir} merge --no-ff -qm merge side`.quiet();
  const db = openStore(":memory:");
  const a = await attributeBug(db,
    { repo: dir, files: ["f.txt"] },
    async () => ({ session: "s-m", worker: "w-m" }));
  // score for a branch-side commit visible only through `git log -- file`
  // must stay below the blame-exact floor (0.75): it describes a range,
  // not a proven line. Auto-kick needs blame-level evidence.
  expect(a.confidence).toBeLessThan(0.75);
  db.close();
  await $`rm -rf ${dir}`.quiet();
});
