# VesteBem — aplicações geradas por agentes de programação (material suplementar de TCC)

Este repositório reúne as **9 aplicações web** analisadas no Trabalho de Conclusão de Curso
*"Vulnerabilidades de segurança em aplicações web geradas por agentes de programação baseados em IA generativa: uma análise à luz do OWASP Top 10:2025"*
(Engenharia de Software — iCEV, Teresina-PI, 2026).

> ⚠️ **As aplicações podem conter vulnerabilidades intencionalmente não corrigidas.** Elas são objeto de estudo.
> Não as implante em produção. Todos os dados de demonstração são fictícios.

## Estrutura

```
prompts/                 enunciados submetidos aos agentes (texto original)
apps/
  claude-opus-5.5/  r1/ r2/ r3/   Claude Opus 5.5  · Claude Code
  gpt-6.1-sol/      r1/ r2/ r3/   GPT-6.1 Sol      · Codex CLI
  gemini-3.8-flash/ r1/ r2/ r3/   Gemini 3.8 Flash · Antigravity CLI (agy)
```

| Modelo | Ferramenta | Esforço de raciocínio | Rodadas |
|---|---|---|---|
| Claude Opus 5.5 | Claude Code | low | r1, r2, r3 |
| GPT-6.1 Sol | Codex CLI | low | r1, r2, r3 |
| Gemini 3.8 Flash | Antigravity CLI (agy) | low | r1, r2, r3 |

## Protocolo de geração (resumo)

- Cada rodada foi iniciada em diretório vazio e em sessão nova da ferramenta.
- Os 4 enunciados de `prompts/` foram enviados em sequência, na mesma sessão, com texto idêntico para todos os modelos e rodadas.
- Não houve intervenção do pesquisador (sem correções, dicas ou instruções adicionais).
- Coleta realizada em 5 de novembro de 2026.
- Foi preservada a **versão final** de cada aplicação (após o 4º enunciado); versões intermediárias não foram armazenadas.

## Integridade do material

- O código em `apps/` está **exatamente como foi gerado** pelos agentes. A tag `coleta-original` marca esse estado.
- Foram removidos apenas artefatos reproduzíveis ou de execução: `node_modules/`, `dist/`, caches do npm (`.npm-cache/`),
  resultados de testes (`test-results/`) e bancos SQLite criados em execução (`*.db`, `*.sqlite` e arquivos `-wal`/`-shm`).
  Por isso, pastas `data/` que continham apenas o banco não aparecem no repositório.
- Segredos fictícios gerados pelos próprios agentes (por exemplo, valores padrão de `JWT_SECRET`) foram mantidos,
  pois fazem parte da avaliação.
- As pastas originais seguiam o padrão `mvp`, `mvp-2`, `mvp-3`, correspondentes a `r1`, `r2`, `r3`.

## Como executar uma aplicação

Cada aplicação tem o seu próprio `README.md`, escrito pelo agente que a gerou, com os comandos de instalação,
inicialização do banco e execução. Requisito geral: Node.js 24 e npm.
