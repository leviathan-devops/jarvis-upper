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

const mod = await import(CONTRACT) as { REQUIRED_CONTEXTS: readonly string[] };
const expected: string[] = [...mod.REQUIRED_CONTEXTS];
const ruleset = JSON.parse(await Bun.file(RULESET).text());

const got: string[] = (ruleset.rules ?? [])
  .filter((r: any) => r.type === "required_status_checks")
  .flatMap((r: any) => (r.parameters?.required_status_checks ?? []).map((c: any) => c.context));

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
