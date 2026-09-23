// interface-check.ts — the cross-plan boundary gate (hydra §0.3).
// Asserts the 7 status contexts agree between Plan A's contract and Plan B's ruleset.
// exit 0 = the two plans agree; exit 1 = they disagree (named); exit 2 = cannot measure.
//
// PATHS resolve against THIS SCRIPT's directory (import.meta.dir), never CWD —
// a checker invoked from the repo root and from scripts/ must behave identically.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const HERE = import.meta.dir;            // .../jarvis-upper/scripts
const ROOT = dirname(HERE);              // .../jarvis-upper
const CONTRACT = join(ROOT, "src", "status-contract.ts");
const RULESET = join(ROOT, "ruleset.json");

if (!existsSync(CONTRACT)) { console.error("INTERFACE-ERROR:contract-missing:" + CONTRACT); process.exit(2); }
if (!existsSync(RULESET))  { console.error("INTERFACE-ERROR:ruleset-missing:" + RULESET);  process.exit(2); }

// THE EXIT-2 CONTRACT: a missing export, a syntax error, or invalid JSON is
// UNMEASURED (exit 2) — never conflated with disagreement (exit 1).
// DYNAMIC-IMPORT EXCEPTION (project rule ts-no-dynamic-import): a static import
// of the contract cannot work here — a loader-time failure (missing file,
// syntax error, missing export) surfaces as an UNCAUGHT loader error, which
// cannot be mapped to the documented exit 2. Only await import() lets this
// gate catch the failure and say "cannot measure" instead of crashing.
interface ContractShape { REQUIRED_CONTEXTS?: unknown; }
let expected: string[] = [];
let ruleset: unknown = null;
try {
  const mod = (await import(CONTRACT)) as ContractShape;
  if (!Array.isArray(mod.REQUIRED_CONTEXTS) || !mod.REQUIRED_CONTEXTS.every((c) => typeof c === "string")) {
    throw new Error("REQUIRED_CONTEXTS missing or not a string array in " + CONTRACT);
  }
  expected = [...mod.REQUIRED_CONTEXTS];
  ruleset = JSON.parse(await Bun.file(RULESET).text());
} catch (e) {
  console.error("INTERFACE-ERROR:unreadable:" + (e instanceof Error ? e.message : String(e)));
  process.exit(2);
}

// Narrow unknown -> string contexts (mirrors tests/interface_match.test.ts):
// a malformed rule (null, missing parameters) is SKIPPED, never projected as
// an undefined entry that would cause false MISSING/EXTRA.
const got: string[] = [];
if (typeof ruleset === "object" && ruleset !== null && "rules" in ruleset && Array.isArray(ruleset.rules)) {
  for (const r of ruleset.rules) {
    if (typeof r !== "object" || r === null) continue;
    if (!("type" in r) || r.type !== "required_status_checks") continue;
    if (!("parameters" in r)) continue;
    const params: unknown = r.parameters;
    if (typeof params !== "object" || params === null) continue;
    if (!("required_status_checks" in params)) continue;
    const checks: unknown = params.required_status_checks;
    if (!Array.isArray(checks)) continue;
    for (const c of checks) {
      if (typeof c !== "object" || c === null) continue;
      if (!("context" in c)) continue;
      if (typeof c.context === "string") got.push(c.context);
    }
  }
} else {
  console.error("INTERFACE-ERROR:ruleset-shape:ruleset.json has no rules array");
  process.exit(2);
}

// CARDINALITY: set-equality is not enough — a duplicated context in the
// ruleset (the same context listed under multiple rules) must not report
// MATCH. Duplicates fail closed with exit 1.
const seenDupes: string[] = got.filter((c, i) => got.indexOf(c) !== i);
const dupes: string[] = seenDupes.filter((c, i) => seenDupes.indexOf(c) === i);
if (dupes.length > 0) {
  for (const d of dupes) console.log("INTERFACE-DUPLICATE:" + d);
  process.exit(1);
}

const missing = expected.filter((c) => !got.includes(c));
const extra   = got.filter((c) => !expected.includes(c));

console.log("contract (" + expected.length + "): " + expected.join(" "));
console.log("ruleset  (" + got.length + "): " + got.join(" "));

if (missing.length || extra.length) {
  for (const m of missing) console.log("INTERFACE-MISSING:" + m);
  for (const e of extra)   console.log("INTERFACE-EXTRA:" + e);
  process.exit(1);
}
console.log("INTERFACE:MATCH (" + expected.length + " contexts)");
process.exit(0);
