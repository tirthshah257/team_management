import { createApp } from './app.js';
import { config } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { getDatabase } from './db/connection.js';

// Ensure database connection and run pending migrations
const db = getDatabase();
runMigrations(db);

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`[TeamFlow Server] Running on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[TeamFlow Server] Shutting down gracefully...');
  server.close(() => {
    console.log('[TeamFlow Server] Closed HTTP server.');
    process.exit(0);
  });
});
