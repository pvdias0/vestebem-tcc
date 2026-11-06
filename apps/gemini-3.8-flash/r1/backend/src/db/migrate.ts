import { runMigrations } from './index';

try {
  console.log('Iniciando execução de migrations...');
  runMigrations();
  console.log('Todas as migrations foram aplicadas com êxito.');
  process.exit(0);
} catch (error) {
  console.error('Erro ao executar migrations:', error);
  process.exit(1);
}
