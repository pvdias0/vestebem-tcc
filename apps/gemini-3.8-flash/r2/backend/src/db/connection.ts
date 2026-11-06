import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.databasePath);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
