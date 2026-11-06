import { createApp } from './app.js';
import { openDatabase } from './database.js';
const db = openDatabase();
const port = Number(process.env.PORT ?? 3001);
const server = createApp(db).listen(port, '127.0.0.1', () => console.log(`VesteBem em http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
