import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../../.env' });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .default('postgresql://cbms_user:cbms_password@localhost:5432/cbms_gis_db'),
  DB_POOL_MAX: z.coerce.number().default(20),
  JWT_SECRET: z.string().default('dev-cbms-secret-key-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('8h'),
});

export const env = EnvSchema.parse(process.env);
