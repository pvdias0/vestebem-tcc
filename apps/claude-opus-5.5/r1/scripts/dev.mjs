// Inicia backend e frontend em modo de desenvolvimento, em paralelo.
import { spawn } from "node:child_process";

const isWin = process.platform === "win32";
const procs = [];
for (const [name, args] of [
  ["backend", ["run", "dev", "--prefix", "backend"]],
  ["frontend", ["run", "dev", "--prefix", "frontend"]],
]) {
  const p = spawn("npm", args, { stdio: "inherit", shell: isWin });
  p.on("exit", (code) => {
    console.log(`[${name}] encerrado (código ${code})`);
    for (const other of procs) if (other !== p) other.kill();
    process.exit(code ?? 0);
  });
  procs.push(p);
}
process.on("SIGINT", () => procs.forEach((p) => p.kill()));
