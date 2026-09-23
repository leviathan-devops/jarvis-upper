// upper CLI: one JSON object on stdout, human text on stderr, exit 0/1/2.
import { fileURLToPath } from "node:url";
import { openStore, tableNames, STORE_PATH } from "./store";
import { VERBS } from "./cli-verbs";

const usage = `usage: upper <init|cursor|status|plan|order|graph|gates|sync|bug|desks|kick> [args]
  init             create/open the store, print tables
  cursor <source>  print last_seq for an event source (default ao-events)`;

const [verb, arg, ...extras] = Bun.argv.slice(2);
if (extras.length > 0 && verb !== "init" && verb !== "cursor") {
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
  VERBS[verb](root, arg).then((r) => {
    console.log(JSON.stringify(r.out));
    process.exit(r.code);
  }).catch((e) => {
    console.error(JSON.stringify({ ok: false, error: String(e).slice(0, 200) }));
    process.exit(1);
  });
} else {
  console.error(usage);
  process.exit(2);
}
