// upper CLI: one JSON object on stdout, human text on stderr, exit 0/1/2.
import { openStore, tableNames, STORE_PATH } from "./store";
import { VERBS } from "./cli-verbs";

const usage = `usage: upper <init|cursor|status|plan|order|graph|gates|sync|bug|desks|kick> [args]
  init             create/open the store, print tables
  cursor <source>  print last_seq for an event source (default ao-events)`;

const [verb, arg, mode] = Bun.argv.slice(2);
if (verb === "order") {
  console.error("order is plan-only: executePlan runs in-process with {confirm:true}; no CLI path prints a merge list for execution");
  process.exit(2);
}
if (verb === "init") {
  const db = openStore();
  const tables = tableNames(db).filter((t) => !t.startsWith("sqlite_"));
  db.close();
  console.log(JSON.stringify({ ok: true, store: STORE_PATH, tables }));
} else if (verb === "cursor") {
  const db = openStore();
  const row = db.query("SELECT last_seq FROM rail_seq WHERE source = ?")
    .get(arg ?? "ao-events") as { last_seq: number } | null;
  db.close();
  console.log(JSON.stringify({ ok: true, source: arg ?? "ao-events", last_seq: row?.last_seq ?? 0 }));
} else if (verb && VERBS[verb]) {
  const root = new URL("..", import.meta.url).pathname;
    void VERBS[verb](root, arg, mode).then((r) => {
    console.log(JSON.stringify(r.out));
    process.exit(r.code);
  });
} else {
  console.error(usage);
  process.exit(2);
}
