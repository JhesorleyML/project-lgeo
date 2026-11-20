import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { env } from '../config/env.js';
import type { Database } from './types.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool] Unexpected error on idle client:', err.message);
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
});

export async function checkPostgisHealth(): Promise<{
  connected: boolean;
  postgisVersion?: string;
  error?: string;
}> {
  try {
    const result = await sql<{ version: string }>`SELECT PostGIS_Full_Version() AS version`.execute(db);
    return {
      connected: true,
      postgisVersion: result.rows[0]?.version,
    };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Database connection failed',
    };
  }
}
