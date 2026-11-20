import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './kysely.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_001_PATH = path.resolve(
  __dirname,
  '../../../../database/migrations/001_initial_cbms_schema.sql',
);
const MIGRATION_002_PATH = path.resolve(
  __dirname,
  '../../../../database/migrations/002_gis_reference_layers.sql',
);

async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('[db:migrate] Connected to PostgreSQL.');

    // 1. Check if initial schema tables already exist
    const existingCheck = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'survey_years'
      ) AS exists;
    `);

    if (existingCheck.rows[0]?.exists) {
      console.log(
        '[db:migrate] Core schema already initialized (`public.survey_years` exists). Skipping 001_initial_cbms_schema.sql.',
      );
    } else {
      console.log(`[db:migrate] Applying migration: ${MIGRATION_001_PATH}`);
      const sqlContent = await fs.readFile(MIGRATION_001_PATH, 'utf-8');
      await client.query(sqlContent);
      console.log('[db:migrate] Successfully applied 001_initial_cbms_schema.sql.');
    }

    // 2. Always apply idempotent 002_gis_reference_layers.sql (`CREATE TABLE IF NOT EXISTS`)
    console.log(`[db:migrate] Applying reference layers migration: ${MIGRATION_002_PATH}`);
    const sql002Content = await fs.readFile(MIGRATION_002_PATH, 'utf-8');
    await client.query(sql002Content);
    console.log('[db:migrate] Successfully verified/applied 002_gis_reference_layers.sql.');

    // 3. Verify PostGIS version and critical spatial indexes
    const postgisRes = await client.query<{ version: string }>(
      `SELECT PostGIS_Full_Version() AS version;`,
    );
    console.log(`[db:migrate] PostGIS active: ${postgisRes.rows[0]?.version ?? 'Unknown'}`);

    const indexRes = await client.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'idx_households_geom',
          'idx_barangays_geom',
          'idx_mv_brgy_yearly_pk',
          'idx_mv_brgy_yearly_geom',
          'idx_land_use_zones_geom',
          'idx_municipal_landmarks_geom',
          'idx_road_networks_geom'
        )
      ORDER BY indexname;
    `);

    console.log(
      `[db:migrate] Verified spatial & MV indexes: ${indexRes.rows.map((r) => r.indexname).join(', ')}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err: unknown) => {
  console.error('[db:migrate] Migration failed:', err);
  process.exit(1);
});
