import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDirectory = process.env.DB_DIR || path.resolve(__dirname, '../../data');
if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

const dbFilePath = process.env.DB_PATH || path.join(dbDirectory, 'vestebem.sqlite');

export const db = new DatabaseSync(dbFilePath);

// Enable foreign keys and WAL mode for better concurrency and integrity
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function getDatabasePath(): string {
  return dbFilePath;
}
