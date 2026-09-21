// W0 gate — `bun test -t does_anything_run`
// Contract under test: the five-question gate AGREES with the tree it is
// pointed at. The test measures each fact INDEPENDENTLY and asserts the gate's
// verdict matches, and that its exit code is 0 iff all five answers are YES.
// Therefore it passes on a library-only tree (5 x NO, exit 1) AND after the
// runtime lands (5 x YES, exit 0) — it is the contract, not a snapshot.
import { test, expect } from "bun:test";
import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;

function sh(cmd: string[]): { code: number; out: string } {
  const p = Bun.spawnSync(cmd, { cwd: ROOT });
  return { code: p.exitCode ?? -1, out: (p.stdout?.toString() ?? "") + (p.stderr?.toString() ?? "") };
}

function gateLines(): { code: number; q: Record<string, string>; raw: string } {
  const { code, out } = sh(["bash", "gates/does_anything_run.sh", ROOT]);
  const q: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = line.match(/^Q(\d):(YES|NO):([^:]+):(.*)$/);
    if (m) q[`Q${m[1]}`] = `${m[2]}|${m[3]}|${m[4]}`;
  }
  return { code, q, raw: out };
}

// ---- independent measurements (no reuse of the gate's own logic) ----
function hasEntry(): boolean {
  return existsSync(`${ROOT}src/main.ts`) || existsSync(`${ROOT}src/runtime.ts`);
}
function loopFiles(): string[] {
  const out: string[] = [];
  const dir = `${ROOT}src`;
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".ts")) continue;
    const body = readFileSync(`${dir}/${f}`, "utf8");
    if (/setInterval|while \(true\)|for \(;;\)/.test(body)) out.push(f);
  }
  return out;
}
function orphanCount(): number {
  const { out } = sh(["bash", "gates/orphan_scan.sh", ROOT]);
  const m = out.match(/ORPHANS=(\d+)/);
  return m ? Number(m[1]) : -1;
}
function wireCapture(): boolean {
  return existsSync(`${ROOT}runtime/wire_capture.json`);
}
function heartbeatRows(): number {
  const p = `${ROOT}runtime/ticks.log`;
  if (!existsSync(p)) return 0;
  const size = statSync(p).size;
  if (size === 0) return 0;
  return readFileSync(p, "utf8").split("\n").filter((l) => l.trim().length > 0).length;
}

test("does_anything_run: the gate emits all five questions with a verdict and evidence", () => {
  const { q, raw } = gateLines();
  expect(Object.keys(q).length).toBe(5);
  for (const k of ["Q1", "Q2", "Q3", "Q4", "Q5"]) {
    expect(q[k]).toBeDefined();
    expect(q[k].split("|")[2].length).toBeGreaterThan(3); // evidence is non-empty
  }
  expect(raw).toContain("VERDICT:");
});

test("does_anything_run: the gate AGREES with independently measured facts", () => {
  const { q } = gateLines();
  expect(q["Q1"].startsWith(hasEntry() ? "YES" : "NO")).toBe(true);
  expect(q["Q2"].startsWith(loopFiles().length > 0 ? "YES" : "NO")).toBe(true);
  expect(q["Q3"].startsWith(orphanCount() === 0 ? "YES" : "NO")).toBe(true);
  expect(q["Q4"].startsWith(wireCapture() ? "YES" : "NO")).toBe(true);
  expect(q["Q5"].startsWith(heartbeatRows() > 0 ? "YES" : "NO")).toBe(true);
});

test("does_anything_run: exit code is 0 iff all five answers are YES", () => {
  const { code, q } = gateLines();
  const anyNo = Object.values(q).some((v) => v.startsWith("NO"));
  expect(code).toBe(anyNo ? 1 : 0);
});

test("does_anything_run: a NO answer NAMES its reason (no silent refusal)", () => {
  const { q } = gateLines();
  for (const [k, v] of Object.entries(q)) {
    if (v.startsWith("NO")) {
      const evidence = v.split("|")[2];
      expect(evidence.length).toBeGreaterThan(10);
      expect(evidence).not.toBe("n/a");
      void k;
    }
  }
});