// Inicia backend (porta 3000) e frontend Vite (porta 5173) em paralelo.
import { spawn, spawnSync } from 'node:child_process';

const procs = ['backend', 'frontend'].map((dir) =>
  spawn(`npm --prefix ${dir} run dev`, { stdio: 'inherit', shell: true }),
);

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) {
    if (p.exitCode !== null || !p.pid) continue;
    // No Windows, kill() encerraria só o shell; taskkill /T encerra a árvore (npm, node --watch, servidor).
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    else p.kill('SIGTERM');
  }
  process.exit();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => { if (code) stop(); });
