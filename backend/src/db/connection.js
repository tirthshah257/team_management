import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';

let dbInstance = null;

export function getDatabase(customPath) {
  if (customPath) {
    return initDb(customPath);
  }
  if (!dbInstance) {
    const resolvedPath = path.isAbsolute(config.DATABASE_PATH)
      ? config.DATABASE_PATH
      : path.resolve(process.cwd(), config.DATABASE_PATH);

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    dbInstance = initDb(resolvedPath);
  }
  return dbInstance;
}

export function setDatabase(db) {
  dbInstance = db;
}

function initDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  try {
    db.prepare('UPDATE users SET must_change_password = 0 WHERE must_change_password = 1').run();
  } catch (e) {
    // Ignore error if table does not exist yet prior to migrations
  }
  return db;
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
