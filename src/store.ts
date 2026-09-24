// Upper store: SQLite WAL, forward-only migrations, append-only ledgers.
import { Database } from "bun:sqlite";
import { fileURLToPath } from "node:url";

// FIXED 2026-09-23 (ocr round-4 HIGH): a file:// URL's `.pathname` is not a
// filesystem path (leading slash before a Windows drive; URL-encoded
// elsewhere). fileURLToPath is the correct, platform-specific conversion.
export const STORE_PATH = process.env.UPPER_STORE ?? fileURLToPath(new URL("../store.sqlite", import.meta.url));

// FIXED (red-team slop audit, the duplicated-authority hunt): this list lived in THREE
// places — adapter-verbs.ts, reducers.ts, and the SQL CHECK below — identical today but
// free to drift. store.ts owns the schema, so it is the single TS authority; the SQL
// CHECK (which cannot import) stays adjacent so the two are read together.
export const PR_STATES = ["open", "ready_to_merge", "merge_ordered", "merged", "rejected", "kicked"] as const;

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS pr_node(
     id TEXT PRIMARY KEY, project TEXT NOT NULL, pr_number INTEGER,
     session_id TEXT, worker_hint TEXT, head_sha TEXT, base_sha TEXT,
     source_branch TEXT, target_branch TEXT, kind TEXT DEFAULT 'feature',
     state TEXT, minted_at INTEGER, merged_at INTEGER, metadata_json TEXT,
     CHECK(state IN ('open','ready_to_merge','merge_ordered','merged','rejected','kicked')),
     CHECK(kind IN ('feature','fix','hardening')));
   CREATE TABLE IF NOT EXISTS pr_edge(
     id TEXT PRIMARY KEY, from_pr TEXT NOT NULL, to_pr TEXT NOT NULL,
     kind TEXT NOT NULL, created_at INTEGER,
     -- FIXED 2026-09-23 (ocr round-4 HIGH): the schema set PRAGMA
     -- foreign_keys=ON yet declared NO foreign keys, so referential integrity
     -- was never enforced and orphans accumulated silently. These clauses
     -- enforce it (the PRAGMA now has teeth).
     FOREIGN KEY (from_pr) REFERENCES pr_node(id),
     FOREIGN KEY (to_pr) REFERENCES pr_node(id));
   CREATE TABLE IF NOT EXISTS gate_pass(
     id TEXT PRIMARY KEY, pr_node TEXT NOT NULL, gate TEXT NOT NULL,
     verdict TEXT NOT NULL, evidence TEXT, sha16 TEXT, head_sha TEXT, at INTEGER,
     -- sha16 = the SPEC INVARIANT hash the gate verified; head_sha = the GIT
     -- COMMIT the gate ran against (the two are different domains — see the
     -- guardrail's STALE-GATE, which compares head_sha to pr_node.head_sha).
     -- Source of truth: GATE_TO_CONTEXT keys in src/status-contract.ts (internal gate names); keep this SQL list in sync.
     CHECK(gate IN ('ci_green','audit','hardened','fence2')),
     FOREIGN KEY (pr_node) REFERENCES pr_node(id));
   CREATE TABLE IF NOT EXISTS bug_record(
     id TEXT PRIMARY KEY, found_by TEXT, category TEXT, severity INTEGER,
     dossier_path TEXT, origin_commit TEXT, origin_session TEXT,
     origin_worker TEXT, attribution_json TEXT,
     attribution_confidence REAL, status TEXT, created_at INTEGER,
     closed_at INTEGER);
   CREATE TABLE IF NOT EXISTS kick(
     id TEXT PRIMARY KEY, bug_record TEXT NOT NULL, mode TEXT NOT NULL,
     target_session TEXT, spawned_session TEXT, dossier_path TEXT,
     dossier_sha16 TEXT, sent_at INTEGER, outcome TEXT, outcome_at INTEGER,
     CHECK(mode IN ('live','spawn','direct')),
     FOREIGN KEY (bug_record) REFERENCES bug_record(id));
   CREATE TABLE IF NOT EXISTS rail_seq(
     source TEXT PRIMARY KEY, last_seq INTEGER NOT NULL, updated_at INTEGER);`,
];

// FIXED (the runtime seat, H2/H5 — MEASURED LIVE, then caught by its own test):
// gate_pass's PK is a surrogate `id`, so (pr_node, gate) could hold MANY rows.
// `recordGatePass` upserts on a JSON-pair id, but a LEGACY row with `id = NULL` never
// conflicts (NULLs are distinct in a SQLite TEXT PK), so stale rows survived forever and
// a stale verdict masked the current one (measured: ci_green = pass(rowid 1, NULL id) +
// fail(rowid 5, the live mirror), and the unordered read returned the stale PASS).
//
// THE ORDER MATTERS AND THE FIRST ATTEMPT GOT IT WRONG: placed in MIGRATIONS, the
// CREATE INDEX ran BEFORE `rebuildIfNoFks` — and a table rebuild DROPS its indexes, so on
// any store whose gate_pass lacked FKs (a fresh or pre-FK store) the index was silently
// destroyed. It survived on the live store only because that one had already been rebuilt.
// This runs AFTER the rebuilds, so it always lands last. Idempotent.
const POST_REBUILD: string[] = [
  // FIXED (the final ship gate HIGH, caught by re-auditing MY OWN W9 fix): the dedupe
  // kept MAX(rowid), but the LIVE read (guardrail.ts:33) orders by `at DESC, rowid DESC`.
  // `recordGatePass` upserts ON CONFLICT(id) — which PRESERVES rowid but BUMPS `at` — so
  // the NEWEST verdict can live on the SMALLEST rowid, and MAX(rowid) would have DROPPED
  // it. The survivor is now chosen by the SAME ordering the read uses.
  `DELETE FROM gate_pass WHERE rowid NOT IN (
     SELECT rowid FROM (
       SELECT rowid, ROW_NUMBER() OVER (PARTITION BY pr_node, gate ORDER BY at DESC, rowid DESC) rn
       FROM gate_pass) WHERE rn = 1);
   CREATE UNIQUE INDEX IF NOT EXISTS gate_pass_pr_gate ON gate_pass(pr_node, gate);`,
];

// FIXED 2026-09-23 (ocr round-4 HIGH): CREATE TABLE IF NOT EXISTS is a no-op on
// a PRE-EXISTING db, so a store.sqlite created before the FK clauses kept its
// FK-less schema forever (orphans kept accumulating despite foreign_keys=ON).
// This migration REBUILDS a table in place when its FK list is empty — the
// documented SQLite table-rebuild recipe (create-new, copy, drop, rename).
// FIXED 2026-09-23 (qwen-code-audit C4/C5 + the SQL-safety note): the rebuild
// (a) dropped the CHECK constraints the MIGRATIONS declare, (b) ran WITHOUT a
// transaction (a mid-rebuild failure lost the table), and (c) interpolated
// PRAGMA-derived names into SQL with no validation. All three closed: the name
// is checked against an allowlist, the rebuild is one transaction, and the
// rebuild SQL carries the SAME CHECKs as MIGRATIONS.
const REBUILDABLE = new Set(["pr_edge", "gate_pass", "kick"]);
function rebuildIfNoFks(db: Database, table: string, createNewSql: string): void {
  if (!REBUILDABLE.has(table)) throw new Error(`REBUILD-TABLE-REFUSED:${table}`);
  const exists = db.query("SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (!exists) return;
  const fks = db.query(`PRAGMA foreign_key_list(${table})`).all();
  if (fks.length > 0) return;
  const newName = `${table}__fk`;
  // column-aware copy: the old table may lack NEWER columns (e.g. gate_pass had
  // no head_sha before the guardrail fix) — map the common ones, NULL the rest.
  const oldCols = (db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  db.exec("BEGIN");
  try {
    db.exec(createNewSql.replace(/CREATE TABLE IF NOT EXISTS \w+/, `CREATE TABLE ${newName}`));
    const newCols = (db.query(`PRAGMA table_info(${newName})`).all() as { name: string }[]).map((c) => c.name);
    const select = newCols.map((c) => (oldCols.includes(c) ? c : `NULL AS ${c}`)).join(", ");
    db.exec(`INSERT INTO ${newName} (${newCols.join(", ")}) SELECT ${select} FROM ${table};`);
    db.exec(`DROP TABLE ${table};`);
    db.exec(`ALTER TABLE ${newName} RENAME TO ${table};`);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw new Error(`REBUILD-FAILED:${table}:${String(e).slice(0, 100)}`); }
}

const FK_REBUILDS: { table: string; sql: string }[] = [
  { table: "pr_edge", sql: `CREATE TABLE IF NOT EXISTS pr_edge(
     id TEXT PRIMARY KEY, from_pr TEXT NOT NULL, to_pr TEXT NOT NULL,
     kind TEXT NOT NULL, created_at INTEGER,
     FOREIGN KEY (from_pr) REFERENCES pr_node(id),
     FOREIGN KEY (to_pr) REFERENCES pr_node(id));` },
  // the CHECKs MIRROR MIGRATIONS (a rebuild must not drop them)
  { table: "gate_pass", sql: `CREATE TABLE IF NOT EXISTS gate_pass(
     id TEXT PRIMARY KEY, pr_node TEXT NOT NULL, gate TEXT NOT NULL,
     verdict TEXT NOT NULL, evidence TEXT, sha16 TEXT, head_sha TEXT, at INTEGER,
     CHECK(gate IN ('ci_green','audit','hardened','fence2')),
     FOREIGN KEY (pr_node) REFERENCES pr_node(id));` },
  { table: "kick", sql: `CREATE TABLE IF NOT EXISTS kick(
     id TEXT PRIMARY KEY, bug_record TEXT NOT NULL, mode TEXT NOT NULL,
     target_session TEXT, spawned_session TEXT, dossier_path TEXT,
     dossier_sha16 TEXT, sent_at INTEGER, outcome TEXT, outcome_at INTEGER,
     CHECK(mode IN ('live','spawn','direct')),
     FOREIGN KEY (bug_record) REFERENCES bug_record(id));` },
];

export function openStore(path?: string): Database {
  const resolved = path ?? (process.env.UPPER_STORE ?? fileURLToPath(new URL("../store.sqlite", import.meta.url)));
  const db = new Database(resolved, { create: true });
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA foreign_keys=ON;");
  for (const sql of MIGRATIONS) db.exec(sql);
  // migrate pre-existing FK-less tables (a fresh db has its FKs from MIGRATIONS)
  // FIXED 2026-09-23 (qwen-code-audit run 3): a THROWING rebuild skipped the
  // PRAGMA ON, leaving the connection with FK enforcement OFF. try/finally.
  db.exec("PRAGMA foreign_keys=OFF;");
  try {
    for (const { table, sql } of FK_REBUILDS) rebuildIfNoFks(db, table, sql);
  } finally { db.exec("PRAGMA foreign_keys=ON;"); }
  // POST-REBUILD: must run AFTER the rebuilds (a rebuild drops a table's indexes).
  // FIXED (ship gate MEDIUM): the DELETE ran unconditionally on EVERY open (a write lock
  // + a data rewrite even with zero duplicates) and the DELETE+CREATE INDEX pair was not
  // transactional (a crash between them left the table deduped but un-indexed). Gate it
  // on an actual duplicate count and wrap the pair in one transaction.
  const dup = db.query("SELECT COUNT(*) c FROM (SELECT 1 FROM gate_pass GROUP BY pr_node, gate HAVING COUNT(*) > 1)").get() as { c: number };
  const needsIndex = !db.query("SELECT 1 x FROM sqlite_master WHERE type='index' AND name='gate_pass_pr_gate'").get();
  if (dup.c > 0 || needsIndex) {
    db.exec("BEGIN");
    try { for (const sql of POST_REBUILD) db.exec(sql); db.exec("COMMIT"); }
    catch (e) { db.exec("ROLLBACK"); throw e; }
  }
  return db;
}

export function tableNames(db: Database): string[] {
  const rows = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}
