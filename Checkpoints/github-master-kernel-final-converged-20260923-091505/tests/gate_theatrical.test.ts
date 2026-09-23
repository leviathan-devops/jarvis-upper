import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = new URL("..", import.meta.url).pathname;
const GATES_YML = join(ROOT, ".github/workflows/gates.yml");
const rawYml = readFileSync(GATES_YML, "utf8");
const yml = parseYaml(rawYml) as Record<string, any>;
const jobs = yml.jobs as Record<string, any>;
const jobKeys = Object.keys(jobs);
const jobNames = jobKeys.map((k) => jobs[k]?.name);

function extractRunBody(): string {
  const idx = rawYml.indexOf("theatrical_verification:");
  expect(idx).toBeGreaterThan(-1);
  const tail = rawYml.slice(idx);
  const m = tail.match(/run:\s*\|?\n([\s\S]*?)(?:\n\s*\w[^\n]*:\s*\n|\s*$)/);
  expect(m?.[1]).toBeTruthy();
  return m![1];
}

function scannerScript(): string {
  const body = extractRunBody()
    .replace(/CHANGED=\$\([^)]+\)/, 'CHANGED="$CHANGED_FILES"')
    .replace(/\$\{BASE\}/g, "${CI_BASE}");
  return ["#!/usr/bin/env bash", "set -e", "CI_BASE=main", body].join("\n");
}

function runScanner(testFile: string): { code: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(
    ["bash", "-c", scannerScript()],
    {
      cwd: ROOT,
      env: { ...process.env, CHANGED_FILES: testFile },
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  return {
    code: result.exitCode ?? -1,
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
  };
}

test("test_gate_theatrical_verification", () => {
  const dir = mkdtempSync(join(tmpdir(), "theatrical-"));
  const badTest = join(dir, "bad.test.ts");
  writeFileSync(badTest, "import { expect, test } from 'bun:test';\n\ntest('tautology', () => {\n  expect(true).toBeTruthy();\n});\n");
  const bad = runScanner(badTest);
  expect(bad.code).toBe(1);
  expect(bad.stdout).toContain("theatrical-verification hit");

  const goodTest = join(dir, "good.test.ts");
  writeFileSync(goodTest, "import { expect, test } from 'bun:test';\nimport { sum } from '../src/math';\n\ntest('real assertion', () => {\n  expect(sum(1, 2)).toBe(3);\n});\n");
  const good = runScanner(goodTest);
  expect(good.code).toBe(0);
  expect(good.stdout).toContain("theatrical-verification: clean");

  expect(jobKeys.length).toBe(6);
  expect(jobNames).toEqual([
    "gates/anti-theatrical",
    "gates/issue-link",
    "gates/spec-gate",
    "gates/diff-budget",
    "gates/test",
    "gates/theatrical-verification",
  ]);
  expect(jobKeys).toContain("theatrical_verification");
  expect(jobNames.join("\n")).toMatch(/^gates\/anti-theatrical\n/);
  expect(rawYml).not.toMatch(/pull_request_target/);
});
