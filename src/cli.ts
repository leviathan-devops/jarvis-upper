// upper CLI: one JSON object on stdout, human text on stderr, exit 0/1/2.
import { fileURLToPath } from "node:url";
import { openStore, tableNames, STORE_PATH } from "./store";
import { VERBS, type VerbResult } from "./cli-verbs";

const usage = `usage: upper <init|cursor|status|plan|order|graph|gates|sync|bug|desks|kick> [args]
  init             create/open the store, print tables
  cursor <source>  print last_seq for an event source (default ao-events)`;

// FIXED (the whole-file scan): the WHOLE dispatch is now shaped. init/cursor shared the VERBS
// path's error contract (a store-open throw escaped as a bare stack before), the VerbResult is
// validated before use, and extras are rejected for the two zero/one-arg fast-paths.
const EXTRA_ALLOWANCE: Record<string, number> = { kick: 1, enroll: 5, arm: 1 };

/** A shaped refusal on stdout + a contract exit code. `code` is 0/1/2 only. */
function fail(code: 1 | 2, out: Record<string, unknown>): never {
  console.log(JSON.stringify(out));
  process.exit(code);
}

const [verb, arg, ...extras] = Bun.argv.slice(2);

function main(): Promise<void> | void {
  if (!verb) { console.error(usage); process.exit(2); }
  // the own-property guard: a bare index hits Object.prototype (`upper __proto__` is truthy).
  const known = verb === "init" || verb === "cursor" || Object.hasOwn(VERBS, verb);
  if (!known) { console.error(usage); process.exit(2); }

  const allowance = Object.hasOwn(EXTRA_ALLOWANCE, verb) ? EXTRA_ALLOWANCE[verb] : 0;
  // FIXED (the scan): init takes ZERO args and cursor at most ONE — extras are now usage/exit-2
  // (they were silently ignored).
  if (verb === "init" && extras.length > 0) { console.error(usage); process.exit(2); }
  if (verb === "cursor" && extras.length > 0) { console.error(usage); process.exit(2); }
  if (verb !== "init" && verb !== "cursor" && extras.length > allowance) { console.error(usage); process.exit(2); }

  if (verb === "init" || verb === "cursor") {
    // FIXED (the scan HIGH): `init`/`cursor` had NO error shaping — a store-open/query throw
    // escaped as a bare stack with an undocumented exit. Both are wrapped in the contract shape.
    try {
      const db = openStore();
      try {
        if (verb === "init") {
          const tables = tableNames(db).filter((t) => !t.startsWith("sqlite_"));
          console.log(JSON.stringify({ ok: true, store: STORE_PATH, tables }));
        } else {
          const row = db.query("SELECT last_seq FROM rail_seq WHERE source = ?")
            .get(arg ?? "ao-events") as { last_seq: number } | null;
          console.log(JSON.stringify({ ok: true, source: arg ?? "ao-events", last_seq: row?.last_seq ?? 0 }));
        }
      } finally { db.close(); }
      process.exit(0);
    } catch (e) {
      fail(1, { ok: false, verdict: "STORE-OPEN-FAILED", error: String(e).slice(0, 300) });
    }
    return;
  }

  const root = fileURLToPath(new URL("..", import.meta.url));
  return (VERBS[verb] as (r: string, a?: string, ...x: string[]) => Promise<VerbResult>)(root, arg, ...extras)
    .then((r) => {
      // FIXED (the scan HIGH): the VerbResult is VALIDATED — a null/undefined return, a missing
      // `out`, or a code outside 0/1/2 would otherwise print `undefined` or exit undocumented.
      if (!r || typeof r !== "object" || typeof r.out !== "object" || r.out === null || ![0, 1, 2].includes(r.code)) {
        fail(1, { ok: false, verdict: "BAD-VERB-RESULT", got: r === null ? "null" : typeof r });
      }
      console.log(JSON.stringify(r.out));
      process.exit(r.code);
    })
    .catch((e) => {
      // FIXED (the scan HIGH): the fragile `String(e).startsWith("StoreRefusal:")` is GONE — the
      // VERBS wrapper already converts a StoreRefusal into a shaped VerbResult, so anything that
      // reaches here is genuinely unexpected. One shape, one exit code.
      fail(1, { ok: false, verdict: "VERB-THREW", error: String(e).slice(0, 300) });
    });
}

void main();
