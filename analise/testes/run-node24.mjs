// Reexecuta os testes dinâmicos nas 9 aplicações com o Node.js desta máquina (Windows, Node 24).
// Trabalha sobre cópias temporárias das pastas originais (sem frontend e sem bancos), com banco novo em cada uma.
// Uso: node run-node24.mjs [app ...]     Resultados: analise/testes/resultados-node24/
import { cpSync, rmSync, mkdirSync, readdirSync, statSync, lstatSync, writeFileSync, existsSync, openSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const T = dirname(fileURLToPath(import.meta.url));
const ROOT = join(T, '..', '..', '..');            // pasta TCC
const OUT = process.env.VT24_OUT || join(T, 'resultados-node24'); mkdirSync(OUT, { recursive: true });
const WORK = join(tmpdir(), 'vt24');
const APPS = {
  'claude-r1': ['Opus-5.5/mvp',   [['dist/migrate-cli.js'], ['dist/seed-cli.js']]],
  'claude-r2': ['Opus-5.5/mvp-2', [['dist/migrate-cli.js'], ['dist/seed.js']]],
  'claude-r3': ['Opus-5.5/mvp-3', [['dist/migrate-cli.js'], ['dist/seed.js']]],
  'gpt-r1':    ['sol-6.1/mvp',    [['dist/migrate.js'], ['dist/seed.js']]],
  'gpt-r2':    ['sol-6.1/mvp-2',  [['dist/db.js'], ['dist/demo.js']]],
  'gpt-r3':    ['sol-6.1/mvp-3',  [['dist/migrate.js'], ['dist/demo.js']]],
  'gemini-r1': ['gemini-3.8/mvp',   [['dist/db/migrate.js'], ['dist/db/seed.js']]],
  'gemini-r2': ['gemini-3.8/mvp-2', [['dist/db/runMigrationsCli.js'], ['dist/db/seed.js']]],
  'gemini-r3': ['gemini-3.8/mvp-3', [['dist/db/migrate.js'], ['dist/db/seed.js']]],
};
const isDb = n => /\.(db|sqlite)(-.*)?$/i.test(n);
const skipDir = n => ['frontend', 'e2e', 'test-results', 'playwright-report', '.git'].includes(n);
function findDb(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n === 'node_modules' || skipDir(n)) continue; const r = findDb(p); if (r) return r; }
    else if (/\.(db|sqlite)$/i.test(n)) return p;
  }
  return null;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2); const todos = args.includes('--todos'); const only = args.filter(a => a !== '--todos');
let port = 4101;
for (const [app, [rel, steps]] of Object.entries(APPS)) {
  if (only.length && !only.includes(app)) continue;
  const p = port++;
  if (!todos && !only.length && existsSync(join(OUT, `${app}.json`))) { console.log(`=== ${app}: já executado, pulando (use --todos para refazer) ===`); continue; }
  try {
  const src = join(ROOT, rel), dst = join(WORK, app);
  console.log(`\n=== ${app} (${rel}) porta ${p} ===`);
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true, filter: s => { const n = basename(s); if (s !== src && lstatSync(s).isSymbolicLink()) return false; return !(skipDir(n) && s !== src) && !isDb(n); } });
  const be = join(dst, 'backend');
  if (app === 'gemini-r3') { // mesmo procedimento da execução original: .sql de src disponibilizados ao código compilado
    mkdirSync(join(be, 'dist/db/migrations'), { recursive: true });
    for (const f of readdirSync(join(be, 'src/db/migrations')).filter(f => f.endsWith('.sql'))) cpSync(join(be, 'src/db/migrations', f), join(be, 'dist/db/migrations', f));
  }
  const env = { ...process.env, NODE_ENV: 'development', PORT: String(p) };
  let seedLog = '';
  for (const s of steps) { try { seedLog += execFileSync(process.execPath, s, { cwd: be, env, encoding: 'utf8', stdio: 'pipe' }); } catch (e) { seedLog += `ERRO ${s}: ${e.stdout}\n${e.stderr}\n`; } }
  writeFileSync(join(OUT, `${app}.seed.log`), seedLog);
  const log = openSync(join(OUT, `${app}.server.log`), 'w');
  const srv = spawn(process.execPath, ['dist/server.js'], { cwd: be, env, stdio: ['ignore', log, log] });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { try { await fetch(`http://127.0.0.1:${p}/api/products`); up = true; } catch { await sleep(500); } }
  if (!up) { console.log('servidor não respondeu; veja', `${app}.server.log`); srv.kill(); continue; }
  const db = findDb(dst); console.log('banco:', db);
  try {
    execFileSync(process.execPath, [join(T, 'runner.mjs'), app, `http://127.0.0.1:${p}`, join(OUT, `${app}.json`)], { env: { ...process.env, VT_DB: db ?? '' }, stdio: 'inherit' });
  } catch (e) { console.log('runner terminou com erro', e.status); }
  srv.kill(); await sleep(500);
  } catch (e) { console.log(`ERRO em ${app}:`, e.message); }
}
console.log('\nConcluído. Agora rode: node comparar-node24.mjs');
