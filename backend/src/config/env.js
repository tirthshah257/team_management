import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root or server directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '5000', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const DATABASE_PATH = process.env.DATABASE_PATH || path.resolve(__dirname, '../../../database/teamflow.db');
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-development-key-change-in-production-min-32-chars-long';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || (NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false');
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, '../../backups');
const BACKUP_KEEP = parseInt(process.env.BACKUP_KEEP || '14', 10);

// Validate required config
if (NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('development') || process.env.JWT_SECRET.length < 32) {
    console.error('FATAL: In production, JWT_SECRET must be explicitly set and be at least 32 characters long.');
    process.exit(1);
  }
}

export const config = {
  NODE_ENV,
  PORT,
  CLIENT_ORIGIN,
  DATABASE_PATH,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  COOKIE_SECURE,
  BACKUP_DIR,
  BACKUP_KEEP,
  isProduction: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test'
};
