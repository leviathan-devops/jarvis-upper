// attribute.ts: deterministic bug→origin commit→session→worker.
// Every assignment carries method+inputs (auditable); <0.6 → triage.
import { Database } from "bun:sqlite";

export interface AttributionInput {
  repo: string;
  files: string[];
  lines?: Record<string, number[]>;
  windowSha?: string | null;
}

export interface Attribution {
  commit: string;
  session: string | null;
  worker: string | null;
  method: string;
  candidates: { commit: string; files: string[]; score: number }[];
  confidence: number;
}

export const CONFIDENCE_FLOOR = 0.6;

interface Proc {
  run(cmd: string[], cwd: string, timeoutMs?: number): Promise<{ code: number; stdout: string; stderr: string }>;
}

const defaultRun = (cmd: string[], cwd: string, timeoutMs = 15000): Promise<{ code: number; stdout: string; stderr: string }> =>
  new Promise((resolve) => {
    const p = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
    const killer = setTimeout(() => { try { p.kill(9); } catch { /* already dead */ } }, timeoutMs);
    // FIXED 2026-09-23 (ocr round-4 HIGH): the callback had no error handling —
    // if p.exited REJECTED (killed by signal) or reading stdout/stderr threw,
    // `resolve` was never called and the promise hung FOREVER (the caller's
    // await never returned). Also `code` can be null on a signal-kill while the
    // type claims `number`. try/catch + a .catch that always resolves; the code
    // is coerced so the type never lies.
    p.exited.then(async (code) => {
      clearTimeout(killer);
      try {
        const [o, e] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
        resolve({ code: Number(code ?? 0), stdout: o, stderr: e });
      } catch (err) {
        resolve({ code: Number(code ?? 1), stdout: "", stderr: `READ-FAILED:${String(err).slice(0, 80)}` });
      }
    }).catch((err) => {
      clearTimeout(killer);
      resolve({ code: 1, stdout: "", stderr: `EXITED-REJECTED:${String(err).slice(0, 80)}` });
    });
  });
export async function candidatesForFiles(
  repo: string,
  files: string[],
  proc: Proc = { run: defaultRun },
): Promise<Map<string, string[]>> {
  // commit -> files it touched (bounded to the flagged set)
  const hit = new Map<string, string[]>();
  for (const f of files) {
    const r = await proc.run(["git", "log", "--format=%H", "--", f], repo);
    if (r.code !== 0) continue;
    for (const sha of r.stdout.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20)) {
      const cur = hit.get(sha) ?? [];
      if (!cur.includes(f)) cur.push(f);
      hit.set(sha, cur);
    }
  }
  return hit;
}

export async function blameLines(
  repo: string,
  files: string[],
  lines: Record<string, number[]> | undefined,
  proc: Proc = { run: defaultRun },
): Promise<Map<string, string[]>> {
  const hit = new Map<string, string[]>();
  for (const f of files) {
    for (const ln of lines?.[f] ?? []) {
      const r = await proc.run(["git", "blame", "-L", `${ln},${ln}`, "--porcelain", "--", f], repo);
      if (r.code !== 0) continue;
      const m = r.stdout.match(/^([0-9a-f]{40}) /m);
      if (m) {
        const cur = hit.get(m[1]) ?? [];
        if (!cur.includes(f)) cur.push(f);
        hit.set(m[1], cur);
      }
    }
  }
  return hit;
}

export interface SessionResolver {
  (commit: string): Promise<{ session: string | null; worker: string | null }>;
}

export async function attributeBug(
  db: Database,
  input: AttributionInput,
  resolve: SessionResolver,
  proc?: Proc,
): Promise<Attribution> {
  const flagged = [...new Set(input.files)];
  const logHits = await candidatesForFiles(input.repo, flagged, proc);
  const blameHits = await blameLines(input.repo, flagged, input.lines, proc);
  // perFile removed: scoring uses logHits/blameHits/scored directly

  // merge commits: only first-parent line counts, capped 0.55 (below the
  // blame floor, so a merge can never outrank an exact blame match)
  const scored: { commit: string; files: string[]; score: number }[] = [];
  for (const [sha, fs] of logHits) {
    const r = await (proc ?? { run: defaultRun })
      .run(["git", "log", "--format=%P", "-1", sha], input.repo);
    const parents = r.code === 0 ? r.stdout.trim().split(/\s+/).filter(Boolean) : [];
    const isMerge = parents.length > 1;
    const uniq = [...new Set(fs)];
    const score = isMerge ? 0.55 : 0.5 + 0.15 * uniq.length + (blameHits.has(sha) ? 0.25 : 0);
    scored.push({ commit: sha, files: uniq, score: Math.min(1, Math.round(score * 100) / 100) });
  }
  for (const [sha, fs] of blameHits) {
    if (scored.some((s) => s.commit === sha)) continue;
    scored.push({ commit: sha, files: [...new Set(fs)], score: 0.75 });
  }
  scored.sort((a, b) => b.score - a.score || a.commit.localeCompare(b.commit));
  const top = scored[0];
  if (!top) {
    return { commit: "", session: null, worker: null, method: "no-candidates",
             candidates: [], confidence: 0 };
  }
  const r = await resolve(top.commit);
  return {
    commit: top.commit,
    session: r.session,
    worker: r.worker,
    method: top.score >= 0.75 && blameHits.has(top.commit) ? "blame+log" : "log",
    candidates: scored.slice(0, 5),
    confidence: top.score,
  };
}
