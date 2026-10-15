import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;

export const DEFAULT_DB_PATH = path.resolve(__dirname, 'teamflow.db');

export function getDatabase(customPath) {
  if (customPath) {
    return initDb(customPath);
  }
  if (!dbInstance) {
    const dbPath = process.env.DATABASE_PATH
      ? (path.isAbsolute(process.env.DATABASE_PATH)
          ? process.env.DATABASE_PATH
          : path.resolve(process.cwd(), process.env.DATABASE_PATH))
      : DEFAULT_DB_PATH;

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    dbInstance = initDb(dbPath);
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
  return db;
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
