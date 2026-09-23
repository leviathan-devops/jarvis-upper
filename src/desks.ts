// Wave A–D fixture engine: assemble/harden/audit/research over LOCAL fixtures.
// Laws: no network, no daemon, no factory PRs. All claims are rows + files.
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { resolve, relative, isAbsolute } from "node:path";
import { writeDossier } from "./dossier";

// FIXED 2026-09-23 (ocr round-4 HIGH): a `startsWith` prefix check is NOT a
// path-containment check — "/root/history/../evil" starts with "/root/history/"
// yet the OS resolves it OUTSIDE. `contained` compares RESOLVED paths via
// `relative`, so `..`, an absolute path, or a nested target can never pass.
function contained(base: string, candidate: string): boolean {
  const rel = relative(resolve(base), resolve(candidate));
  return rel !== "" && rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel);
}

// FIXED 2026-09-23 (ocr round-4 rescan-4 HIGH): `target` was interpolated into
// `${fx.root}/ship/${target}-v1` UNVALIDATED — `../../evil` escaped the fixture
// root. A single-segment assertion (no separators, no "..") makes it inert.
const SEG_RE = /^[A-Za-z0-9._-]+$/;
function assertSegment(name: string, v: string): void {
  if (!SEG_RE.test(v) || v.includes("..")) throw new Error(`INVALID-${name}:${v}`);
}

export interface FixtureSet {
  root: string;
}

const sha16 = (s: string) =>
  createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

export async function waveA(db: Database, fx: FixtureSet, target: string): Promise<{ manifest: string; files: number }> {
  assertSegment("TARGET", target);
  let prs: { files: string[] };
  try { prs = JSON.parse(await Bun.file(`${fx.root}/pr-set.json`).text()); } catch (e) { throw new Error(`FIXTURE-PARSE-ERROR:pr-set.json:${String(e).slice(0,80)}`); }
  const dir = `${fx.root}/ship/${target}-v1`;
  if (fx.root === "/" || fx.root === "") throw new Error("FIXTURE-ROOT-REFUSED");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  const rows: { path: string; sha16: string }[] = [];
  for (const f of prs.files) {
    const historyRoot = resolve(`${fx.root}/history`);
    const resolved = resolve(historyRoot, f);
    if (!contained(historyRoot, resolved)) throw new Error(`PATH-TRAVERSAL:${f}`);
    const body = await Bun.file(resolved).text();
    const dest = resolve(dir, f);
    if (!contained(dir, dest)) throw new Error(`PATH-TRAVERSAL-DEST:${f}`);
    await Bun.write(dest, body);
    rows.push({ path: f, sha16: sha16(body) });
  }
  const manifest = JSON.stringify({ target, files: rows }, null, 2);
  await Bun.write(`${dir}/manifest.json`, manifest);
  return { manifest: `${dir}/manifest.json`, files: rows.length };
}

export async function waveB(db: Database, fx: FixtureSet, target: string): Promise<{ hardened: boolean; token: string }> {
  assertSegment("TARGET", target);
  let defect: { file: string; fix: string; test: string };
  try { defect = JSON.parse(await Bun.file(`${fx.root}/defect.json`).text()); } catch (e) { throw new Error(`FIXTURE-PARSE-ERROR:defect.json:${String(e).slice(0,80)}`); }
  // FIXED 2026-09-23 (ocr round-4 HIGH): defect.file / defect.test are
  // UNTRUSTED fixture input used directly in paths — `../../etc/cron.d/evil`
  // wrote outside the fixture root. Both are containment-checked now.
  const shipRoot = resolve(`${fx.root}/ship/${target}-v1`);
  const path = resolve(shipRoot, defect.file);
  if (!contained(shipRoot, path)) throw new Error(`PATH-TRAVERSAL-DEFECT:${defect.file}`);
  const before = await Bun.file(path).text();
  if (!before.includes(defect.fix)) {
    await Bun.write(path, before + `\n${defect.fix}\n`);
  }
  const fxRoot = resolve(fx.root);
  const testPath = resolve(fxRoot, defect.test);
  if (!contained(fxRoot, testPath)) throw new Error(`PATH-TRAVERSAL-TEST:${defect.test}`);
  const testOut = await Bun.file(testPath).text();
  const after = await Bun.file(path).text();
  // FIXED 2026-09-23 (the new FK): gate_pass references pr_node — a fixture
  // gate-pass row must have its pr_node. Mint it (idempotent) first.
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, state, minted_at) VALUES (?, 'fixture', 0, NULL, 'open', strftime('%s','now')) ON CONFLICT(id) DO NOTHING")
    .run(target);
  db.query("INSERT INTO gate_pass(id, pr_node, gate, verdict, evidence, sha16, at) VALUES (?,?,?,?,?, ?,strftime('%s','now'))")
    .run(`w4b:${target}`, target, "hardened", "pass", testOut.slice(0, 200), sha16(after));
  return { hardened: true, token: "hardened" };
}

export async function waveC(db: Database, fx: FixtureSet, bugId: string): Promise<{ recorded: boolean }> {
  assertSegment("BUGID", bugId);
  let seed: { file: string; lines: number[]; symptom: string; originCommit: string };
  try { seed = JSON.parse(await Bun.file(`${fx.root}/seeded-defect.json`).text()); } catch (e) { throw new Error(`FIXTURE-PARSE-ERROR:seeded-defect.json:${String(e).slice(0,80)}`); }
  const md = `# BUG ${bugId}\n\nsymptom: ${seed.symptom}\nfile: ${seed.file}:${seed.lines.join(",")}\n`;
  const origin = { originCommit: seed.originCommit, method: "seeded-fixture", confidence: 1 };
  const m = await writeDossier(`${fx.root}/../dossiers-root`, bugId, md, origin);
  db.query(`INSERT INTO bug_record(id, found_by, category, severity, dossier_path, origin_commit, attribution_confidence, status, created_at)
            VALUES (?, 'waveC-audit', 'seeded', 2, ?, ?, 1, 'open', strftime('%s','now'))`)
    .run(bugId, `${fx.root}/../dossiers-root/dossiers/${bugId}`, seed.originCommit);
  void m;
  return { recorded: true };
}

export async function waveD(db: Database, fx: FixtureSet): Promise<{ reported: boolean; verdicts: number }> {
  let contract: { problems: { id: string; text: string; candidates: { id: string; text: string; evidence: string[] }[] }[] };
  try { contract = JSON.parse(await Bun.file(`${fx.root}/research.json`).text()); } catch (e) { throw new Error(`FIXTURE-PARSE-ERROR:research.json:${String(e).slice(0,80)}`); }

  const verdicts = contract.problems.flatMap((p) =>
    p.candidates.map((c) => ({
      problem: p.id,
      solution: c.id,
      verdict: c.evidence.length > 0 ? "validate" : "unknown",
      evidence: c.evidence,
      unknowns: c.evidence.length > 0 ? [] : ["no-evidence-supplied"],
    })));
  await Bun.write(`${fx.root}/research-report.json`, JSON.stringify({ verdicts }, null, 2));
  void db;
  return { reported: verdicts.length > 0, verdicts: verdicts.length };
}
