import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || 'vestebem-super-secret-key-prod-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  cookieName: 'vestebem_token',
  databasePath: process.env.DATABASE_PATH || path.resolve(__dirname, '../../data/vestebem.sqlite'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
