// spec-diff.ts — Plan B spec-gate helper (CI step: `bun run scripts/spec-diff.ts`).
// Every enumerated §6 SCOPE item in the build package spec must map to at least
// one file changed in this PR (`git diff --name-only origin/main...HEAD`).
// Prints one line per scope item — MAPPED:<n>:<file> or UNMAPPED:<n>.
//   exit 0 = every scope item maps to a changed file
//   exit 1 = at least one scope item maps to nothing (fail closed)
//   exit 2 = cannot measure: the spec file is absent, the scope section (or its
//            items) is unreadable, or the diff itself is unreadable.
//            The unmeasured case is never a pass.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SPEC = "../packages/jarvis-upper-tier/jarvis_upper_tier_DPL1_SPEC.md";
const ROOT = join(import.meta.dir, "..");
const SPEC_ABS = join(ROOT, SPEC);

if (!existsSync(SPEC_ABS)) {
  console.log(`SPEC-DIFF:no spec found at ${SPEC}`);
  process.exit(2);
}

const lines = readFileSync(SPEC_ABS, "utf8").split("\n");
const start = lines.findIndex((l) => /^##\s+§6\b/.test(l));
if (start < 0) {
  console.log(`SPEC-DIFF:no scope section in ${SPEC}`);
  process.exit(2);
}
let end = lines.findIndex((l, k) => k > start && /^##\s+/.test(l));
if (end < 0) end = lines.length;

interface ScopeItem { n: string; text: string; }
const items: ScopeItem[] = [];
for (const line of lines.slice(start + 1, end)) {
  const m = line.match(/^(\d+)\.\s+(.*)$/);
  if (m) items.push({ n: m[1], text: m[2].trim() });
  else if (items.length > 0 && /^\s+\S/.test(line)) items[items.length - 1].text += " " + line.trim();
}
if (items.length === 0) {
  console.log(`SPEC-DIFF:no scope items in ${SPEC}`);
  process.exit(2);
}

const diff = Bun.spawnSync(["git", "diff", "--name-only", "origin/main...HEAD"], { cwd: ROOT });
if (diff.exitCode !== 0) {
  const err = (diff.stderr?.toString() ?? "").trim().split("\n")[0];
  console.log(`SPEC-DIFF:no diff available (${err || "git diff failed"})`);
  process.exit(2);
}
const files = (diff.stdout?.toString() ?? "").split("\n").map((s) => s.trim()).filter((s) => s.length > 0);

const STOP_WORDS = "the and for with via from into over under plus per its this that these those such each every both all any are was were been has have had will would should could must may also than then when where which while only existing happy path during surface format".split(" ");
const STOP: Record<string, true> = Object.fromEntries(STOP_WORDS.map((w) => [w, true]));
const PATH_NOISE_WORDS = ["ts", "py", "js", "md", "yml", "yaml", "sh", "json", "toml", "lock", "src", "tests"];
const PATH_NOISE: Record<string, true> = Object.fromEntries(PATH_NOISE_WORDS.map((w) => [w, true]));
const SHORT_OK_WORDS = ["cli", "sse", "wal", "api"];
const SHORT_OK: Record<string, true> = Object.fromEntries(SHORT_OK_WORDS.map((w) => [w, true]));

const words = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const itemKeys = (text: string): string[] => words(text).filter((w) => w.length >= 4 && !STOP[w]);
const fileToks = (p: string): string[] => words(p).filter((w) => !PATH_NOISE[w] && w.length >= 3);

let unmapped = 0;
for (const item of items) {
  const lower = item.text.toLowerCase();
  const hit = files.find((f) => {
    const fl = f.toLowerCase();
    if (itemKeys(lower).some((k) => fl.includes(k))) return true;
    return fileToks(f).some((t) => (t.length >= 4 || SHORT_OK[t]) && lower.includes(t));
  });
  if (hit) console.log(`MAPPED:${item.n}:${hit}`);
  else { console.log(`UNMAPPED:${item.n}`); unmapped += 1; }
}
console.log(`SPEC-DIFF:mapped=${items.length - unmapped} unmapped=${unmapped} files=${files.length}`);
process.exit(unmapped > 0 ? 1 : 0);
