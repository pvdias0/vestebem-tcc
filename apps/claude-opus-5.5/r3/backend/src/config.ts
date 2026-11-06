import path from 'node:path';

const backendRoot = path.resolve(import.meta.dirname, '..');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? path.join(backendRoot, 'data', 'vestebem.db'),
  migrationsDir: path.join(backendRoot, 'migrations'),
  frontendDist: path.resolve(backendRoot, '..', 'frontend', 'dist'),
  sessionDays: 7,
  cookieSecure: process.env.COOKIE_SECURE === 'true',
};
