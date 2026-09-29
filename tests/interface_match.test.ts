// W6 — `bun test -t test_interface_match`
// Contract under test: src/status-contract.ts REQUIRED_CONTEXTS agrees with
// ruleset.json required_status_checks AND with every gates/* job name in
// .github/workflows/gates.yml. Real file reads + real YAML/JSON parse, no
// re-implementation. Fails closed on any drift (exit nonzero = mismatch).
import { test, expect } from "bun:test";
import { parse as parseYaml } from "yaml";
import { REQUIRED_CONTEXTS } from "../src/status-contract";

const ROOT = new URL("..", import.meta.url).pathname;
const RULESET = `${ROOT}ruleset.json`;
const GATES_YML = `${ROOT}.github/workflows/gates.yml`;

test("test_interface_match", async () => {
  // 1. import REQUIRED_CONTEXTS from the contract (static import above).
  const expected: string[] = [...REQUIRED_CONTEXTS];

  // 2. read ruleset.json and extract the contexts, same projection as
  // scripts/interface-check.ts (required_status_checks rules only).
  const raw: unknown = JSON.parse(await Bun.file(RULESET).text());
  if (typeof raw !== "object" || raw === null || !("rules" in raw)) {
    throw new Error("ruleset.json has no rules array");
  }
  const rulesUnknown: unknown = raw.rules;
  if (!Array.isArray(rulesUnknown)) {
    throw new Error("ruleset.json rules is not an array");
  }
  const got: string[] = [];
  for (const rule of rulesUnknown) {
    if (typeof rule !== "object" || rule === null) continue;
    if (!("type" in rule) || rule.type !== "required_status_checks") continue;
    if (!("parameters" in rule)) continue;
    const parameters: unknown = rule.parameters;
    if (typeof parameters !== "object" || parameters === null) continue;
    if (!("required_status_checks" in parameters)) continue;
    const checks: unknown = parameters.required_status_checks;
    if (!Array.isArray(checks)) continue;
    for (const entry of checks) {
      if (typeof entry !== "object" || entry === null) continue;
      if (!("context" in entry)) continue;
      const ctx: unknown = entry.context;
      if (typeof ctx === "string") got.push(ctx);
    }
  }

  // 3. the two arrays are EQUAL (same length, same order).
  expect(got).toEqual(expected);

  // 4. the length is 8 (6 gates/* jobs + factory/fence2 + factory/verdict).
  expect(expected.length).toBe(8);
  expect(got.length).toBe(8);

  // 5. every `name:` in .github/workflows/gates.yml that starts with
  // `gates/` is IN the contract's REQUIRED_CONTEXTS — real YAML parse.
  const doc: unknown = parseYaml(await Bun.file(GATES_YML).text());
  if (typeof doc !== "object" || doc === null || !("jobs" in doc)) {
    throw new Error("gates.yml has no jobs mapping");
  }
  const jobs: unknown = doc.jobs;
  if (typeof jobs !== "object" || jobs === null) {
    throw new Error("gates.yml jobs is not a mapping");
  }
  const ciGatesNames: string[] = [];
  for (const job of Object.values(jobs)) {
    if (typeof job !== "object" || job === null) continue;
    if (!("name" in job)) continue;
    const name: unknown = job.name;
    if (typeof name === "string" && name.startsWith("gates/")) ciGatesNames.push(name);
  }
  expect(ciGatesNames.length).toBeGreaterThan(0);
  for (const name of ciGatesNames) {
    expect(expected).toContain(name);
  }
});
