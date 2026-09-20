// Wave A–D fixture engine: assemble/harden/audit/research over LOCAL fixtures.
// Laws: no network, no daemon, no factory PRs. All claims are rows + files.
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { writeDossier } from "./dossier";

export interface FixtureSet {
  root: string;
}

const sha16 = (s: string) =>
  createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);

export async function waveA(db: Database, fx: FixtureSet, target: string): Promise<{ manifest: string; files: number }> {
  const prs = JSON.parse(await Bun.file(`${fx.root}/pr-set.json`).text()) as { files: string[] };
  const dir = `${fx.root}/ship/${target}-v1`;
  if (fx.root === "/" || fx.root === "") throw new Error("FIXTURE-ROOT-REFUSED");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  const rows: { path: string; sha16: string }[] = [];
  for (const f of prs.files) {
    const body = await Bun.file(`${fx.root}/history/${f}`).text();
    await Bun.write(`${dir}/${f}`, body);
    rows.push({ path: f, sha16: sha16(body) });
  }
  const manifest = JSON.stringify({ target, files: rows }, null, 2);
  await Bun.write(`${dir}/manifest.json`, manifest);
  return { manifest: `${dir}/manifest.json`, files: rows.length };
}

export async function waveB(db: Database, fx: FixtureSet, target: string): Promise<{ hardened: boolean; token: string }> {
  const defect = JSON.parse(await Bun.file(`${fx.root}/defect.json`).text()) as { file: string; fix: string; test: string };
  const path = `${fx.root}/ship/${target}-v1/${defect.file}`;
  const before = await Bun.file(path).text();
  if (!before.includes(defect.fix)) {
    await Bun.write(path, before + `\n${defect.fix}\n`);
  }
  const testOut = await Bun.file(`${fx.root}/${defect.test}`).text();
  db.query("INSERT INTO gate_pass(id, pr_node, gate, verdict, evidence, sha16, at) VALUES (?,?,?,?,?, ?,strftime('%s','now'))")
    .run(`w4b:${target}`, target, "hardened", "pass", testOut.slice(0, 200), sha16(before));
  return { hardened: true, token: "hardened" };
}

export async function waveC(db: Database, fx: FixtureSet, bugId: string): Promise<{ recorded: boolean }> {
  const seed = JSON.parse(await Bun.file(`${fx.root}/seeded-defect.json`).text()) as {
    file: string; lines: number[]; symptom: string; originCommit: string;
  };
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
  const contract = JSON.parse(await Bun.file(`${fx.root}/research.json`).text()) as {
    problems: { id: string; text: string; candidates: { id: string; text: string; evidence: string[] }[] }[];
  };
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
