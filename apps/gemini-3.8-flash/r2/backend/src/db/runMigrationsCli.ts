import { runMigrations } from './migrate.js';

try {
  runMigrations();
  console.log('Migrações concluídas com sucesso!');
  process.exit(0);
} catch (error) {
  console.error('Erro ao executar migrações:', error);
  process.exit(1);
}
