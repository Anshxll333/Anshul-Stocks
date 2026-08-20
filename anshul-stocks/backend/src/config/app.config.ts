import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  environment: string;
  corsOrigins: string[];
  databaseUrl: string;
  jwtSecret: string;
}

export default registerAs('app', (): AppConfig => ({
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/anshul_stocks',
  jwtSecret:
    process.env.JWT_SECRET || 'supersecretjwtkeyforanshulstocksapplication2026',
}));
