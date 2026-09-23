// spec-audit.ts — GS-1..GS-8: the eight mechanical questions a SPEC must
// survive before it may be pinned. Mirrors the code-audit for the OTHER
// artifact: the one that defines what "done" means.
// Usage: bun scripts/spec-audit.ts [spec-path]
//
// PATHS resolve against THIS SCRIPT's directory (import.meta.dir), never CWD —
// an audit invoked from the repo root and from scripts/ must behave identically.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const HERE = import.meta.dir;            // .../jarvis-upper/scripts
const ROOT = dirname(HERE);              // .../jarvis-upper
const specPath = Bun.argv[2] ?? join(ROOT, "../packages/jarvis-upper-tier/jarvis_upper_tier_DPL1_SPEC.md");
// THE EXIT-2 CONTRACT (L9): a gate that cannot measure says so — it never
// crashes with a raw ENOENT, and it never silently passes. In CI the spec
// lives OUTSIDE the repo (../packages/...), so its absence is EXPECTED there.
if (!existsSync(specPath)) {
  console.error(`SPEC-AUDIT-ERROR:spec-missing:${specPath}`);
  console.error("  the spec is not reachable — the audit cannot measure.");
  console.error("  exit 2 (UNMEASURED) — never 0, never 1.");
  process.exit(2);
}
const spec = readFileSync(specPath, "utf8");

const lines = spec.split("\n");
const findSection = (startRe: RegExp, endRe: RegExp): string => {
  const i = lines.findIndex((l) => startRe.test(l));
  if (i < 0) return "";
  const j = lines.findIndex((l, k) => k > i && endRe.test(l));
  return lines.slice(i, j < 0 ? lines.length : j).join("\n");
};
const criteria = findSection(/^#+ .*SUCCESS CRITERIA/i, /^#+ /i) || findSection(/^#+ §7/i, /^#+ §8/i);
const scope = findSection(/^#+ .*SCOPE/i, /^#+ /i) || findSection(/^#+ §6/i, /^#+ §7/i);
// FAIL-CLOSED: a missing COMPLETION CHECKLIST section is "" — never the whole
// spec. Re-testing the whole spec here would re-test the GS-1 subset, so a
// spec with no checklist could never fail GS-6 (fail-open).
const checklist = findSection(/^#+ .*COMPLETION CHECKLIST/i, /$^/) || "";

let fails = 0;
const check = (id: string, ok: boolean, detail: string) => {
  console.log(`${id}:${ok ? "PASS" : "FAIL"}:${detail}`);
  if (!ok) fails += 1;
};

// GS-1 LIVENESS CRITERION — at least one criterion names a PROCESS artifact
const PROC_RE = /\b(entry point|loop|tick|heartbeat|listener|daemon up|process)\b/i;
const liveness = criteria.split("\n").filter((l) => PROC_RE.test(l));
check("GS-1", liveness.length > 0, liveness.length > 0
  ? `${liveness.length} criterion line(s) name a process artifact`
  : "NO criterion names a process artifact (a library satisfies every criterion)");

// GS-2 NON-STUB PROOF — a criterion naming a live object names its non-stub evidence
const LIVE_RE = /\b(live|real)\s+(session|wire|daemon)\b/i;
const NONSTUB_RE = /(non-stub|real session id|observed in a tool result|via the adapter)/i;
const liveLines = criteria.split("\n").filter((l) => LIVE_RE.test(l));
const stubProof = liveLines.filter((l) => NONSTUB_RE.test(l));
check("GS-2", liveLines.length === 0 || stubProof.length === liveLines.length,
  liveLines.length === 0 ? "no live-named criteria to prove"
  : `${stubProof.length}/${liveLines.length} live-named criteria carry a non-stub requirement`);

// GS-3 NOUN COVERAGE — the mission's nouns appear as scope items.
// NOUNS is a PINNED contract (reviewed against 00-MISSION.md when the mission
// changes) — it is read from no file at runtime, so it cannot drift silently.
const NOUNS = ["graph", "comms", "filepaths", "guardrail"];
const missingNouns = NOUNS.filter((n) => !new RegExp(n, "i").test(scope));
check("GS-3", missingNouns.length === 0,
  missingNouns.length === 0 ? `all mission nouns present in scope (${NOUNS.join(", ")})`
  : `SCOPE-NOUN-LOST:${missingNouns.join(",")}`);

// GS-4 SHAPE FREEZE — declared test ids vs implemented
const declared = (spec.match(/(?:bun test -t |-t )([a-z0-9_-]+)/g) ?? []).map((m) => m.replace(/.*-t /, ""));
const dt = (spec.match(/DT[_-]?[0-9]+/g) ?? []).map((m) => m.replace(/_/g, "-").replace(/^DT-?([0-9]+)$/, "DT$1"));
const impl = existsSync(join(ROOT, "tests")) ? readdirSync(join(ROOT, "tests")).map((f) => f.replace(/\.test\.ts$/, "")) : [];
const drift = [...new Set([...declared, ...dt])].filter((id) => !impl.some((f) => f.includes(id.replace("DT", "dt").toLowerCase()) || f === id));
check("GS-4", drift.length === 0, drift.length === 0 ? "every declared test id is implemented"
  : drift.map((d) => `TEST-SHAPE-DRIFT:${d}`).join(" "));

// GS-5 BATTERY-IS-NOT-A-CRITERION — a battery token may not stand alone
const batteryLine = criteria.split("\n").filter((l) => /pass\s*\/\s*0\s*fail|battery/i.test(l));
check("GS-5", batteryLine.length === 0 || liveness.length > 0,
  batteryLine.length === 0 ? "no battery-only criterion"
  : liveness.length > 0 ? "battery token present AND a liveness criterion exists"
  : "BATTERY-AS-SOLE-EVIDENCE");

// GS-6 CHECKLIST LIVENESS ROW — the spec's own completion checklist carries it
check("GS-6", PROC_RE.test(checklist),
  PROC_RE.test(checklist) ? "the completion checklist carries a liveness row"
  : "CHECKLIST-MISSING-LIVENESS");

// GS-7 TRANSLATION DIFF — scope nouns must reach the criteria as tokens
const nounTokens = NOUNS.filter((n) => new RegExp(n, "i").test(criteria));
check("GS-7", nounTokens.length === NOUNS.length,
  nounTokens.length === NOUNS.length ? `all nouns translated into criteria (${NOUNS.join(", ")})`
  : `TRANSLATION-HOLE:${NOUNS.filter((n) => !nounTokens.includes(n)).join(",")}`);

// GS-8 CLASS BY DECLARATION — the doc declares its own class in its header
const declaredClass = /(HONEST_CLASS|class:|type:\s*(product_tui|artifact_skill|infra_spine|product_browser))/i.test(
  lines.slice(0, 20).join("\n"));
check("GS-8", declaredClass, declaredClass ? "the document declares its class in the header"
  : "CLASS-BY-FILENAME (no declared class in the header)");

console.log(`VERDICT:${fails === 0 ? "APPROVED" : "REJECTED"} (fail=${fails})`);
console.log(`findings: ${fails} of 8 gates failed on ${specPath}`);
process.exit(fails === 0 ? 0 : 1);
