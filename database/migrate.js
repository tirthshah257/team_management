import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

export function runMigrations(db) {
  const database = db || getDatabase();

  // Create schema_migrations table if not exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  const appliedRows = database.prepare('SELECT version FROM schema_migrations').all();
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (!appliedVersions.has(file)) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Execute migration inside a transaction
      const applyMigration = database.transaction(() => {
        database.exec(sql);
        database.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
      });

      applyMigration();
      console.log(`[Migration] Applied ${file}`);
      count++;
    }
  }

  if (count === 0) {
    console.log('[Migration] Database is up to date.');
  } else {
    console.log(`[Migration] Successfully applied ${count} migration(s).`);
  }

  return count;
}

// Allow direct CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const db = getDatabase();
    runMigrations(db);
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  }
}
