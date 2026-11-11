#!/bin/bash
# Uso: run-app.sh <app> <porta>   — prepara banco limpo, sobe o backend compilado, executa os testes e encerra.
set -u
APP=$1; PORT=$2; T=$(cd "$(dirname "$0")" && pwd); D=$HOME/run/$APP/backend; OUT=$T/resultados; mkdir -p $OUT
cd $D
find .. -path ../frontend -prune -o -path '*/node_modules' -prune -o \( -name '*.db' -o -name '*.db-*' -o -name '*.sqlite' -o -name '*.sqlite-*' \) -print | xargs -r rm -f
case $APP in
  claude-r1) node dist/migrate-cli.js; node dist/seed-cli.js;;
  claude-r2|claude-r3) node dist/migrate-cli.js; node dist/seed.js;;
  gemini-r1) node dist/db/migrate.js; node dist/db/seed.js;;
  gemini-r2) node dist/db/runMigrationsCli.js; node dist/db/seed.js;;
  # gemini-r3: o build (tsc) não copia os arquivos .sql; o README manda migrar a partir de src (tsx src/db/migrate.ts).
  # Para reproduzir o procedimento documentado sem tsx, os .sql de src são disponibilizados ao código compilado.
  gemini-r3) mkdir -p dist/db/migrations && cp src/db/migrations/*.sql dist/db/migrations/; node dist/db/migrate.js; node dist/db/seed.js;;
  gpt-r1) node dist/migrate.js; node dist/seed.js;;
  gpt-r2) node dist/db.js; node dist/demo.js;;
  gpt-r3) node dist/migrate.js; node dist/demo.js;;
esac > $OUT/$APP.seed.log 2>&1
PORT=$PORT NODE_ENV=development node dist/server.js > $OUT/$APP.server.log 2>&1 &
PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null localhost:$PORT/api/products && break; sleep 0.5; done
export VT_DB=$(find .. -path ../frontend -prune -o \( -name '*.db' -o -name '*.sqlite' \) -print | head -1)
echo "banco: $VT_DB"
node $T/runner.mjs $APP http://127.0.0.1:$PORT $OUT/$APP.json
kill $PID 2>/dev/null; wait $PID 2>/dev/null
