import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDbPath } from "../config.js";
import { seed } from "./seed.js";

export type Db = DatabaseSync;

let db: DatabaseSync | null = null;

/** Find the migrations directory (works under tsx from src/ and under node from dist/). */
function migrationsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "migrations"),
    path.join(here, "..", "migrations"),
    path.join(here, "..", "..", "src", "migrations"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  throw new Error(`[AutoFlow] migrations directory not found (looked in ${candidates.join(", ")})`);
}

function applyMigrations(db: DatabaseSync): void {
  // The tracking table must exist before we can check it (migration 001
  // also creates it — IF NOT EXISTS makes this safe).
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const dir = migrationsDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const applied = db
      .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
      .get(version);
    if (applied) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
      version,
      new Date().toISOString(),
    );
    console.log(`[AutoFlow] Applied migration ${version}`);
  }
}

/**
 * Open (creating if needed) the SQLite database, enforce foreign keys,
 * apply versioned migrations in order, and run idempotent seeds.
 * Pass an explicit path in tests to use a temp database.
 */
export function initDb(dbPath: string = resolveDbPath()): DatabaseSync {
  if (db && dbPath === resolveDbPath()) return db;
  const dir = path.dirname(dbPath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
  const instance = new DatabaseSync(dbPath);
  instance.exec("PRAGMA foreign_keys = ON");
  applyMigrations(instance);
  seed(instance);
  if (dbPath === resolveDbPath()) db = instance;
  return instance;
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error("[AutoFlow] Database not initialised — call initDb() first");
  return db;
}

export function closeDb(): void {
  if (db) {
    try {
      db.close();
    } catch {
      // Already closed — safe to ignore.
    }
    db = null;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
