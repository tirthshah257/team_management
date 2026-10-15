import Database from 'better-sqlite3';
import { runMigrations } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { setDatabase } from '../src/db/connection.js';

export function createTestApp() {
  // In-memory database with standard pragmas
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Run real migrations
  runMigrations(db);

  // Set as active db for application requests
  setDatabase(db);

  const app = createApp();

  return {
    app,
    db,
    cleanup: () => {
      setDatabase(null);
      db.close();
    }
  };
}

export function extractCookies(setCookieHeaders) {
  if (!setCookieHeaders) return '';
  return setCookieHeaders.map(c => c.split(';')[0]).join('; ');
}
