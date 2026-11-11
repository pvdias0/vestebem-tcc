// Compara, caso a caso, as sugestões dos testes em Node 22 (resultados/) e Node 24 (resultados-node24/).
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const T = dirname(fileURLToPath(import.meta.url));
const apps = ['claude-r1','claude-r2','claude-r3','gpt-r1','gpt-r2','gpt-r3','gemini-r1','gemini-r2','gemini-r3'];
let total = 0, iguais = 0; const dif = [], linhas = ['app;caso;node22;node24'];
for (const a of apps) {
  const f22 = join(T, 'resultados', `${a}.json`), f24 = join(T, 'resultados-node24', `${a}.json`);
  if (!existsSync(f24)) { console.log(a, ': sem resultado em Node 24'); continue; }
  const r22 = JSON.parse(readFileSync(f22, 'utf8')), r24 = JSON.parse(readFileSync(f24, 'utf8'));
  for (const ct of Object.keys(r22.resultados).filter(k => k.startsWith('CT')).sort()) {
    const s22 = r22.resultados[ct]?.sugestao, s24 = r24.resultados[ct]?.sugestao; total++;
    linhas.push(`${a};${ct};${s22};${s24}`);
    if (s22 === s24) iguais++; else dif.push(`${a} ${ct}: Node 22 = ${s22} | Node 24 = ${s24}`);
  }
  console.log(a, 'node', r24.node, r24.resultados._erro ? 'ERRO: ' + r24.resultados._erro.slice(0, 120) : '');
}
writeFileSync(join(T, 'resultados-node24', 'comparacao.csv'), linhas.join('\n'));
console.log(`\n${iguais}/${total} resultados iguais.`); dif.forEach(d => console.log('DIFERENTE', d));
