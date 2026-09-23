// spec-diff.ts — Plan B spec-gate helper (CI step: `bun run scripts/spec-diff.ts`).
// Every enumerated §6 SCOPE item in the build package spec must map to at least
// one file changed in this PR (`git diff --name-only origin/main...HEAD`).
// Prints one line per scope item — MAPPED:<n>:<file> or UNMAPPED:<n>.
//   exit 0 = every scope item maps to a changed file
//   exit 1 = at least one scope item maps to nothing (fail closed)
//   exit 2 = cannot measure: the spec file is absent, the scope section (or its
//            items) is unreadable, or the diff itself is unreadable.
//            The unmeasured case is never a pass.
//
// MAPPING IS TOKEN-BOUNDARY (never a substring): item text and file paths go
// through the SAME tokenizer (camelCase split + lowercase + non-alnum split),
// and a key maps only on whole-token equality. Generic singletons that
// matched everything under substring logic (test/tests/gate/gates) are STOP
// words, so e.g. "container test rig" no longer maps to any *.test.ts merely
// for containing "test". Short tokens (cli/sse/wal/api) map on the same
// equality — no asymmetric SHORT_OK allowlist.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SPEC = "../packages/jarvis-upper-tier/jarvis_upper_tier_DPL1_SPEC.md";
const ROOT = join(import.meta.dir, "..");
const SPEC_ABS = join(ROOT, SPEC);

if (!existsSync(SPEC_ABS)) {
  console.log(`SPEC-DIFF:no spec found at ${SPEC}`);
  process.exit(2);
}

// TOCTOU: existsSync passing does not mean the read succeeds (permissions,
// EISDIR, race deletion) — a failed read is UNMEASURED (exit 2), never a crash.
let specText = "";
try {
  specText = readFileSync(SPEC_ABS, "utf8");
} catch (e) {
  console.log(`SPEC-DIFF:no spec readable (${e instanceof Error ? e.message.split("\n")[0] : "read failed"})`);
  process.exit(2);
}
const lines = specText.split("\n");
// Scope sections may be H2 or H3; items may be numbered or bulleted. The
// section ends at the next header of the SAME or HIGHER level, so ###
// subsections (and their bullets) under a ## scope stay inside the scope.
const start = lines.findIndex((l) => /^#{2,3}\s+§6\b/.test(l));
if (start < 0) {
  console.log(`SPEC-DIFF:no scope section in ${SPEC}`);
  process.exit(2);
}
const startLevel = (lines[start].match(/^(#{2,3})\s/) ?? ["", "##"])[1].length;
const endRe = startLevel === 2 ? /^#{1,2}\s+/ : /^#{1,3}\s+/;
let end = lines.findIndex((l, k) => k > start && endRe.test(l));
if (end < 0) end = lines.length;

interface ScopeItem { n: string; text: string; }
const items: ScopeItem[] = [];
for (const line of lines.slice(start + 1, end)) {
  const nm = line.match(/^(\d+)\.\s+(.*)$/);
  if (nm) items.push({ n: nm[1], text: nm[2].trim() });
  else {
    const bm = line.match(/^[-*•]\s+(.*)$/);
    if (bm) items.push({ n: String(items.length + 1), text: bm[1].trim() });
    else if (items.length > 0 && /^\s+\S/.test(line)) items[items.length - 1].text += " " + line.trim();
  }
}
if (items.length === 0) {
  console.log(`SPEC-DIFF:no scope items in ${SPEC}`);
  process.exit(2);
}

// The diff itself can fail (no origin/main, git missing) — UNMEASURED, exit 2.
let diffFiles = "";
try {
  const diff = Bun.spawnSync(["git", "diff", "--name-only", "origin/main...HEAD"], { cwd: ROOT });
  if ((diff.exitCode ?? -1) !== 0) {
    const err = (diff.stderr?.toString() ?? "").trim().split("\n")[0];
    console.log(`SPEC-DIFF:no diff available (${err || "git diff failed"})`);
    process.exit(2);
  }
  diffFiles = (diff.stdout?.toString() ?? "");
} catch (e) {
  console.log(`SPEC-DIFF:no diff available (${e instanceof Error ? e.message.split("\n")[0] : "spawn failed"})`);
  process.exit(2);
}
const files = diffFiles.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);

const STOP_WORDS = "the and for with via from into over under plus per its this that these those such each every both all any are was were been has have had will would should could must may also than then when where which while only existing happy path during surface format test tests gate gates".split(" ");
const STOP: Record<string, true> = Object.fromEntries(STOP_WORDS.map((w) => [w, true]));
const PATH_NOISE_WORDS = ["ts", "py", "js", "md", "yml", "yaml", "sh", "json", "toml", "lock", "src", "tests"];
const PATH_NOISE: Record<string, true> = Object.fromEntries(PATH_NOISE_WORDS.map((w) => [w, true]));

// One tokenizer for BOTH sides: camelCase (syncProject -> sync project) is
// split so identifier-concatenations meet file stems at a token boundary
// instead of via substring. Same floor (3) both sides — no asymmetry.
const words = (s: string): string[] =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const itemKeys = (text: string): string[] => words(text).filter((w) => w.length >= 3 && !STOP[w]);
const fileToks = (p: string): string[] => words(p).filter((w) => !PATH_NOISE[w] && w.length >= 3);

let unmapped = 0;
for (const item of items) {
  const seen: Record<string, true> = {};
  const keys: string[] = [];
  for (const k of itemKeys(item.text)) {
    if (!seen[k]) { seen[k] = true; keys.push(k); }
  }
  // Whole-token equality against one file's tokens — `plan` never meets
  // `explain`, `test` never maps an item by itself (it is STOP).
  const hit = keys.length > 0 ? files.find((f) => {
    const toks = fileToks(f);
    return keys.some((k) => toks.includes(k));
  }) : undefined;
  if (hit) console.log(`MAPPED:${item.n}:${hit}`);
  else { console.log(`UNMAPPED:${item.n}`); unmapped += 1; }
}
console.log(`SPEC-DIFF:mapped=${items.length - unmapped} unmapped=${unmapped} files=${files.length}`);
process.exit(unmapped > 0 ? 1 : 0);
