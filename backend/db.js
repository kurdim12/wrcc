// SQLite connection + schema bootstrap. Uses Node 22+/24 built-in `node:sqlite`,
// so there is no native dependency to compile. Single shared instance.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
const dbPath = process.env.PG_DB_PATH || path.join(dataDir, 'palmguard.db');
const schemaPath = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA foreign_keys = ON');

const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

// Idempotent column migration for DBs created before the dose/ML columns
// existed. CREATE TABLE above already includes them for fresh DBs; this only
// patches an older file. SQLite has no "ADD COLUMN IF NOT EXISTS", so we check
// PRAGMA table_info first.
const ensureColumn = (table, column, ddl) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    console.log(`[db] migrated: added ${table}.${column}`);
  }
};
ensureColumn('devices',  'armed',         'armed INTEGER DEFAULT 0');
ensureColumn('devices',  'max_doses_day', 'max_doses_day INTEGER DEFAULT 4');
ensureColumn('devices',  'cooldown_s',    'cooldown_s INTEGER DEFAULT 1800');
ensureColumn('devices',  'pump_ms',       'pump_ms INTEGER DEFAULT 2000');
ensureColumn('devices',  'auto_confirm',  'auto_confirm INTEGER DEFAULT 0');
ensureColumn('devices',  'last_dose_ts',  'last_dose_ts INTEGER');
ensureColumn('readings', 'p_activity',    'p_activity REAL');
ensureColumn('readings', 'model_version', 'model_version TEXT');

export default db;
export { dbPath };

// Convenience: epoch seconds (matches schema convention).
export const now = () => Math.floor(Date.now() / 1000);

// Tiny query helpers used across routes.
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
