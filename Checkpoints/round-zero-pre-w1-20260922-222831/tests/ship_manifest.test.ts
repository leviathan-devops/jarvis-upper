// W4 gate: fence2 PASS spec_bound:true on package manifest (real adjudicator).
import { test, expect } from "bun:test";
import { $ } from "bun";
import { openStore } from "../src/store";
import { waveA, waveB, waveC, waveD } from "../src/desks";

const F2 = "/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py";

async function fxRoot(): Promise<string> {
  const dir = (await $`mktemp -d`.text()).trim();
  await $`mkdir -p ${dir}/history`.quiet();
  await Bun.write(`${dir}/pr-set.json`, JSON.stringify({ files: ["mod.ts", "lib.ts"] }));
  await Bun.write(`${dir}/history/mod.ts`, "export const a = 1;\n");
  await Bun.write(`${dir}/history/lib.ts`, "export const b = 2;\n");
  await Bun.write(`${dir}/defect.json`, JSON.stringify({ file: "mod.ts", fix: "// hardened: bounds-checked", test: "defect-test.txt" }));
  await Bun.write(`${dir}/defect-test.txt`, "hardening proof: bounds-check present\n");
  await Bun.write(`${dir}/seeded-defect.json`, JSON.stringify({ file: "mod.ts", lines: [1], symptom: "unbounded index", originCommit: "seed123" }));
  await Bun.write(`${dir}/research.json`, JSON.stringify({ problems: [{ id: "P1", text: "x?", candidates: [{ id: "A", text: "y", evidence: ["e1"] }] }] }));
  return dir;
}

// fence2 v2 contract (proven against matrix M1 shape, never assumed):
// explicit steps block with absolute artifact, sha16 map with REAL hash,
// done-when `test -f ./manifest.json` (relative — bwrap bind visibility
// depends on the invoker cwd). Three dead forms burned to learn this:
// job-root-relative artifact (artifact-not-absolute), bare `FILL` map
// (bad-sha16-value), init-after-sha (SPEC_FORGED: init MUTATES SPEC,
// so the invariant sha must be taken AFTER init — and even then the
// v1-form implicit step never resolves correctly).
test("ship_manifest: wave A assembles manifest; real fence2 adjudicates PASS spec_bound:true", async () => {
  const fx = await fxRoot();
  const db = openStore(":memory:");
  const a = await waveA(db, { root: fx }, "w4");
  expect(a.files).toBe(2);
  const man = JSON.parse(await Bun.file(a.manifest).text()) as { files: { path: string; sha16: string }[] };
  expect(man.files.length).toBe(2);
  const job = (await $`mktemp -d`.text()).trim();
  await $`cp ${a.manifest} ${job}/manifest.json`.quiet();
  const art = `${job}/manifest.json`;
  const artSha = (await $`python3 -c "import hashlib;print(hashlib.sha256(open('${art}','rb').read()).hexdigest()[:16])"`.text()).trim();
  await Bun.write(`${job}/SPEC.md`,
    `job: w4-ship\nseat: fixture\nsteps:\n` +
    `  - id: ship\n    artifact: ${art}\n    done-when:\n` +
    `      - test -f ./manifest.json\n    depends: []\n    retries: 0\n    silence_s: 90\n` +
    `sha16:\n  ship: ${artSha}\n`);
  const sha = (await $`python3 ${F2} invariant-sha ${job}`.text()).trim();
  const r = await $`python3 ${F2} adjudicate ${job} --expect-spec-sha ${sha}`.quiet().nothrow();
  expect(r.exitCode).toBe(0);
  const tail = (await $`tail -n 1 /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl`.text()).trim();
  const row = JSON.parse(tail) as { verdict: string; evidence: string };
  expect(row.verdict).toBe("PASS");
  expect(row.evidence.includes("spec_bound:true")).toBe(true);
  db.close();
  await $`rm -rf ${fx} ${job}`.quiet();
}, 60000);

test("ship_manifest: wave B hardens named defect only", async () => {
  const fx = await fxRoot();
  const db = openStore(":memory:");
  await waveA(db, { root: fx }, "w4");
  const b = await waveB(db, { root: fx }, "w4");
  expect(b.hardened).toBe(true);
  expect(b.token).toBe("hardened");
  const body = await Bun.file(`${fx}/ship/w4-v1/mod.ts`).text();
  expect(body.includes("bounds-checked")).toBe(true);
  db.close();
  await $`rm -rf ${fx}`.quiet();
});

test("ship_manifest: wave C seeded defect MUST emit bug_record (silent fix is FAIL)", async () => {
  const fx = await fxRoot();
  const db = openStore(":memory:");
  const c = await waveC(db, { root: fx }, "w4-seed-1");
  expect(c.recorded).toBe(true);
  const row = db.query("SELECT origin_commit, status FROM bug_record WHERE id='w4-seed-1'").get() as
    { origin_commit: string; status: string } | null;
  if (!row) throw new Error("seeded defect produced NO bug_record — SILENT FIX, wave FAILS");
  expect(row.origin_commit).toBe("seed123");
  expect(row.status).toBe("open");
  db.close();
  await $`rm -rf ${fx}`.quiet();
});

test("ship_manifest: wave D emits cited verdicts only", async () => {
  const fx = await fxRoot();
  const db = openStore(":memory:");
  const d = await waveD(db, { root: fx });
  expect(d.reported).toBe(true);
  const rep = JSON.parse(await Bun.file(`${fx}/research-report.json`).text()) as
    { verdicts: { verdict: string; evidence: string[] }[] };
  expect(rep.verdicts.length).toBe(1);
  expect(rep.verdicts[0].verdict).toBe("validate");
  expect(rep.verdicts[0].evidence.length).toBeGreaterThanOrEqual(1);
  db.close();
  await $`rm -rf ${fx}`.quiet();
});
