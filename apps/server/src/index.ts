import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { checkPostgisHealth } from './db/kysely.js';
import { authenticateJwt } from './middleware/auth-rbac.js';
import { gisRouter } from './modules/gis/gis.routes.js';
import { etlRouter } from './modules/etl/etl.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(authenticateJwt);

/**
 * System & PostGIS Health Check Endpoint
 */
app.get('/api/v1/health', async (_req, res) => {
  const dbHealth = await checkPostgisHealth();
  res.json({
    status: 'ok',
    service: 'cbms-web-gis-api',
    timestamp: new Date().toISOString(),
    database: dbHealth,
  });
});

/**
 * Core Web-GIS Spatial Routes, CBMS 312-Column ETL Routes & Multi-Dimension Report Routes
 */
app.use('/api/v1/gis', gisRouter);
app.use('/api/v1/etl', etlRouter);
app.use('/api/v1/reports', reportsRouter);

app.listen(env.PORT, () => {
  console.log(`[CBMS Web-GIS Server] Listening on http://localhost:${env.PORT}`);
});
