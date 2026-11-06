import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import orderRoutes from './routes/orderRoutes';
import productRoutes from './routes/productRoutes';
import { runMigrations } from './db/index';

dotenv.config();

// Inicializa e executa migrações do banco de dados na inicialização
runMigrations();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', store: 'VesteBem', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[VesteBem Backend] Servidor rodando na porta ${PORT} (http://localhost:${PORT})`);
});
