import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './db/migrate.js';
import { authRouter } from './routes/auth.routes.js';
import { orderRouter } from './routes/order.routes.js';
import { productRouter } from './routes/product.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure migrations are run before starting request handling
runMigrations();

export const app = express();

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// API health endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'VesteBem API' });
});

// Authentication routes
app.use('/api/auth', authRouter);

// Orders routes
app.use('/api/orders', orderRouter);

// Products routes
app.use('/api/products', productRouter);

// Serve frontend static build in production if available
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3001;

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  app.listen(PORT, () => {
    console.log(`[VesteBem Backend] Servidor rodando na porta ${PORT}`);
    console.log(`[VesteBem Backend] Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}
