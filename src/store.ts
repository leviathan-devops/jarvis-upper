// Upper store: SQLite WAL, forward-only migrations, append-only ledgers.
import { Database } from "bun:sqlite";

export const STORE_PATH = process.env.UPPER_STORE ?? new URL("../store.sqlite", import.meta.url).pathname;

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

export function openStore(path?: string): Database {
  const resolved = path ?? (process.env.UPPER_STORE ?? new URL("../store.sqlite", import.meta.url).pathname);
  const db = new Database(resolved, { create: true });
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA foreign_keys=ON;");
  for (const sql of MIGRATIONS) db.exec(sql);
  return db;
}

export function tableNames(db: Database): string[] {
  const rows = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}
