import { createApp } from './app.js';
import { openDatabase } from './db.js';
const db = openDatabase();
const server = createApp(db).listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`VesteBem: http://localhost:${process.env.PORT || 3000}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
