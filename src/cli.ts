// upper CLI: one JSON object on stdout, human text on stderr, exit 0/1/2.
import { fileURLToPath } from "node:url";
import { openStore, tableNames, STORE_PATH } from "./store";
import { VERBS, type VerbResult } from "./cli-verbs";

const usage = `usage: upper <init|cursor|status|plan|order|graph|gates|sync|bug|desks|kick> [args]
  init             create/open the store, print tables
  cursor <source>  print last_seq for an event source (default ao-events)`;

const [verb, arg, ...extras] = Bun.argv.slice(2);
// FIXED (ship-gate MEDIUM): `kick` accepts ONE extra (its mode). Without this the
// documented `upper kick <id> live` was rejected by the dispatcher, so verbKick's
// mode param was unreachable.
// MULTI-PROJECT: `enroll` takes 4-5 positionals (path id owner repo [tokenEnv] [--dry-run]).
// FIXED (the audit HIGH G-c): `arm` accepts ONE extra (its `[--no-factory]` flag) — without
// this the documented flag was rejected by the dispatcher and verbArm's param was unreachable.
// FIXED (the ship gate low): a LOOKUP MAP, not a growing nested ternary (the no-nested-ternary
// rule; and it scales as verbs gain extra positionals).
const EXTRA_ALLOWANCE: Record<string, number> = { kick: 1, enroll: 5, arm: 1 };
// FIXED (ship gate low): a bare index hits the prototype chain (`upper __proto__ ...`); the
// own-property guard returns undefined for anything not a defined verb.
const extraAllowance = Object.hasOwn(EXTRA_ALLOWANCE, verb ?? "") ? EXTRA_ALLOWANCE[verb] : 0;
if (extras.length > extraAllowance && verb !== "init" && verb !== "cursor") {
  console.error(usage);
  process.exit(2);
}
if (verb === "init") {
  const db = openStore();
  // FIXED 2026-09-23 (ocr round-4 HIGH): a throw between open and close leaked
  // the connection — db.close() now runs in finally.
  try {
    const tables = tableNames(db).filter((t) => !t.startsWith("sqlite_"));
    console.log(JSON.stringify({ ok: true, store: STORE_PATH, tables }));
  } finally { db.close(); }
} else if (verb === "cursor") {
  const db = openStore();
  try {
    const row = db.query("SELECT last_seq FROM rail_seq WHERE source = ?")
      .get(arg ?? "ao-events") as { last_seq: number } | null;
    console.log(JSON.stringify({ ok: true, source: arg ?? "ao-events", last_seq: row?.last_seq ?? 0 }));
  } finally { db.close(); }
} else if (verb && VERBS[verb]) {
  // FIXED 2026-09-23 (the muse rounds' consistency sweep): a file:// URL's
  // `.pathname` is not a filesystem path (Windows drive-letter prefix; URL
  // encoding elsewhere). fileURLToPath is the platform-correct conversion — the
  // same fix already applied in main.ts and store.ts.
  const root = fileURLToPath(new URL("..", import.meta.url));
  // FIXED 2026-09-23 (qwen-code-audit runs 3-6, the most-repeated high): the
  // verb CONTRACT is "one JSON object + exit 0/1/2". A verb throw is now shaped
  // as a VerbResult-shaped error on stderr with exit 1 (a NEGATIVE verdict), so
  // a caller always gets the documented shape, never a bare stack.
  Promise.resolve()
    .then(() => (VERBS[verb] as (r: string, a?: string, ...x: string[]) => Promise<VerbResult>)(root, arg, ...extras))
    .then((r) => { console.log(JSON.stringify(r.out)); process.exit(r.code); })
    .catch((e) => {
      // FIXED (the ship gate medium): a store-resolution refusal is a SHAPED exit 2, not a stack.
      if (String(e).startsWith("StoreRefusal:")) {
        console.log(JSON.stringify({ ok: false, refused: String(e).replace(/^StoreRefusal:\s*/, "").slice(0, 240) }));
        process.exit(2);
      }
      console.error(JSON.stringify({ ok: false, verdict: "VERB-THREW", error: String(e).slice(0, 300) }));
      process.exit(1);
    });
} else {
  console.error(usage);
  process.exit(2);
}
