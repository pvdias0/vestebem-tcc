import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { authRouter } from './routes/authRoutes.js';
import { orderRouter } from './routes/orderRoutes.js';
import { productRouter } from './routes/productRoutes.js';

export function createApp() {
  const app = express();

  // Middleware base
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'vestebem-backend' });
  });

  // Rotas de produtos (catálogo público e gestão por funcionários)
  app.use('/api/products', productRouter);

  // Rotas de autenticação e conta
  app.use('/api/auth', authRouter);

  // Rotas de pedidos
  app.use('/api/orders', orderRouter);

  // Tratamento de erro 404 para rotas não encontradas
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ message: 'Recurso não encontrado.' });
  });

  // Tratamento global de erros
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Erro interno no servidor.';
    if (statusCode === 500) {
      console.error('Erro não tratado na requisição:', err);
    }
    res.status(statusCode).json({ message });
  });

  return app;
}

// Iniciar servidor se chamado diretamente
export function startServer() {
  // Garantir que as migrações estejam aplicadas
  runMigrations();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Servidor VesteBem rodando na porta ${config.port}`);
  });

  return server;
}
