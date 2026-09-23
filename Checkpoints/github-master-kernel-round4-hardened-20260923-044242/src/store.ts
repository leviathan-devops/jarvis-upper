// Upper store: SQLite WAL, forward-only migrations, append-only ledgers.
import { Database } from "bun:sqlite";
import { fileURLToPath } from "node:url";

// FIXED 2026-09-23 (ocr round-4 HIGH): a file:// URL's `.pathname` is not a
// filesystem path (leading slash before a Windows drive; URL-encoded
// elsewhere). fileURLToPath is the correct, platform-specific conversion.
export const STORE_PATH = process.env.UPPER_STORE ?? fileURLToPath(new URL("../store.sqlite", import.meta.url));

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

// FIXED 2026-09-23 (ocr round-4 HIGH): CREATE TABLE IF NOT EXISTS is a no-op on
// a PRE-EXISTING db, so a store.sqlite created before the FK clauses kept its
// FK-less schema forever (orphans kept accumulating despite foreign_keys=ON).
// This migration REBUILDS a table in place when its FK list is empty — the
// documented SQLite table-rebuild recipe (create-new, copy, drop, rename).
function rebuildIfNoFks(db: Database, table: string, createNewSql: string): void {
  const exists = db.query("SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (!exists) return;
  const fks = db.query(`PRAGMA foreign_key_list(${table})`).all();
  if (fks.length > 0) return;
  const newName = `${table}__fk`;
  db.exec(createNewSql.replace(/CREATE TABLE IF NOT EXISTS \w+/, `CREATE TABLE ${newName}`));
  // column-aware copy: the old table may lack NEWER columns (e.g. gate_pass had
  // no head_sha before the guardrail fix) — map the common ones, NULL the rest.
  const oldCols = (db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  const newCols = (db.query(`PRAGMA table_info(${newName})`).all() as { name: string }[]).map((c) => c.name);
  const select = newCols.map((c) => (oldCols.includes(c) ? c : `NULL AS ${c}`)).join(", ");
  db.exec(`INSERT INTO ${newName} (${newCols.join(", ")}) SELECT ${select} FROM ${table};`);
  db.exec(`DROP TABLE ${table};`);
  db.exec(`ALTER TABLE ${newName} RENAME TO ${table};`);
}

const FK_REBUILDS: { table: string; sql: string }[] = [
  { table: "pr_edge", sql: `CREATE TABLE IF NOT EXISTS pr_edge(
     id TEXT PRIMARY KEY, from_pr TEXT NOT NULL, to_pr TEXT NOT NULL,
     kind TEXT NOT NULL, created_at INTEGER,
     FOREIGN KEY (from_pr) REFERENCES pr_node(id),
     FOREIGN KEY (to_pr) REFERENCES pr_node(id));` },
  { table: "gate_pass", sql: `CREATE TABLE IF NOT EXISTS gate_pass(
     id TEXT PRIMARY KEY, pr_node TEXT NOT NULL, gate TEXT NOT NULL,
     verdict TEXT NOT NULL, evidence TEXT, sha16 TEXT, head_sha TEXT, at INTEGER,
     FOREIGN KEY (pr_node) REFERENCES pr_node(id));` },
  { table: "kick", sql: `CREATE TABLE IF NOT EXISTS kick(
     id TEXT PRIMARY KEY, bug_record TEXT NOT NULL, mode TEXT NOT NULL,
     target_session TEXT, spawned_session TEXT, dossier_path TEXT,
     dossier_sha16 TEXT, sent_at INTEGER, outcome TEXT, outcome_at INTEGER,
     FOREIGN KEY (bug_record) REFERENCES bug_record(id));` },
];

export function openStore(path?: string): Database {
  const resolved = path ?? (process.env.UPPER_STORE ?? fileURLToPath(new URL("../store.sqlite", import.meta.url)));
  const db = new Database(resolved, { create: true });
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA foreign_keys=ON;");
  for (const sql of MIGRATIONS) db.exec(sql);
  // migrate pre-existing FK-less tables (a fresh db has its FKs from MIGRATIONS)
  db.exec("PRAGMA foreign_keys=OFF;");
  for (const { table, sql } of FK_REBUILDS) rebuildIfNoFks(db, table, sql);
  db.exec("PRAGMA foreign_keys=ON;");
  return db;
}

export function tableNames(db: Database): string[] {
  const rows = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}
