// spec-audit.ts — GS-1..GS-8: the eight mechanical questions a SPEC must
// survive before it may be pinned. Mirrors the code-audit for the OTHER
// artifact: the one that defines what "done" means.
// Usage: bun scripts/spec-audit.ts [spec-path] [mission-path]
import { existsSync, readFileSync, readdirSync } from "node:fs";

const specPath = Bun.argv[2] ?? "../packages/jarvis-upper-tier/jarvis_upper_tier_DPL1_SPEC.md";
const missionPath = Bun.argv[3] ?? "../packages/jarvis-upper-tier/00-MISSION.md";
const spec = readFileSync(specPath, "utf8");
const mission = existsSync(missionPath) ? readFileSync(missionPath, "utf8") : "";

const lines = spec.split("\n");
const findSection = (startRe: RegExp, endRe: RegExp): string => {
  const i = lines.findIndex((l) => startRe.test(l));
  if (i < 0) return "";
  const j = lines.findIndex((l, k) => k > i && endRe.test(l));
  return lines.slice(i, j < 0 ? lines.length : j).join("\n");
};
const criteria = findSection(/^#+ .*SUCCESS CRITERIA/i, /^#+ /i) || findSection(/^#+ §7/i, /^#+ §8/i);
const scope = findSection(/^#+ .*SCOPE/i, /^#+ /i) || findSection(/^#+ §6/i, /^#+ §7/i);
const checklist = findSection(/^#+ .*COMPLETION CHECKLIST/i, /$^/) || spec;

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

// GS-3 NOUN COVERAGE — the mission's nouns appear as scope items
const NOUNS = ["graph", "comms", "filepaths", "guardrail"];
const missingNouns = NOUNS.filter((n) => !new RegExp(n, "i").test(scope));
check("GS-3", missingNouns.length === 0,
  missingNouns.length === 0 ? `all mission nouns present in scope (${NOUNS.join(", ")})`
  : `SCOPE-NOUN-LOST:${missingNouns.join(",")}`);

// GS-4 SHAPE FREEZE — declared test ids vs implemented
const declared = (spec.match(/(?:bun test -t |-t )([a-z_]+)/g) ?? []).map((m) => m.replace(/.*-t /, ""));
const dt = (spec.match(/DT[123]/g) ?? []);
const impl = existsSync("tests") ? readdirSync("tests").map((f) => f.replace(/\.test\.ts$/, "")) : [];
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
