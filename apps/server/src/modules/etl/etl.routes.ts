import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { Router } from 'express';
import multer from 'multer';
import { sql } from 'kysely';
import {
  hasFullDataAccess,
  type EtlValidationWarning,
  type SurveyYearSummary,
  type UploadBatchSummary,
  type UserRole,
} from '@cbms/shared';
import { db, pool } from '../../db/kysely.js';
import { runCbmsEtlJob, type EtlJobInput } from './cbms-etl-processor.js';

export const etlRouter = Router();

const uploadDir = path.join(os.tmpdir(), 'cbms-etl-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
  limits: {
    fileSize: 150 * 1024 * 1024, // 150 MB max
  },
});

function resolveEffectiveRole(req: {
  user?: { role: UserRole };
  headers: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}): UserRole {
  if (req.user?.role) return req.user.role;
  const headerRole = String(req.headers['x-cbms-role'] ?? '').toUpperCase();
  if (
    headerRole === 'ADMIN' ||
    headerRole === 'MUNICIPAL_STATISTICIAN' ||
    headerRole === 'MPDC' ||
    headerRole === 'STAFF'
  ) {
    return headerRole;
  }
  const bodyRole = String(req.body?.role ?? req.query?.role ?? '').toUpperCase();
  if (
    bodyRole === 'ADMIN' ||
    bodyRole === 'MUNICIPAL_STATISTICIAN' ||
    bodyRole === 'MPDC' ||
    bodyRole === 'STAFF'
  ) {
    return bodyRole;
  }
  return 'ADMIN';
}

function dispatchEtlJobInWorker(job: EtlJobInput): void {
  try {
    const workerUrl = new URL(
      import.meta.url.endsWith('.ts') ? './cbms-etl.worker.ts' : './cbms-etl.worker.js',
      import.meta.url,
    );
    const worker = new Worker(workerUrl, {
      workerData: job,
      execArgv: process.execArgv,
    });

    let fallbackTriggered = false;
    worker.on('error', (err) => {
      console.warn(
        '[CBMS ETL] Worker thread encountered startup error, falling back to async processor:',
        err.message,
      );
      if (!fallbackTriggered) {
        fallbackTriggered = true;
        runCbmsEtlJob(job).catch((e) =>
          console.error('[CBMS ETL] Async fallback failed:', e),
        );
      }
    });
  } catch {
    runCbmsEtlJob(job).catch((e) =>
      console.error('[CBMS ETL] Async job execution failed:', e),
    );
  }
}

async function ensureSurveyYear(
  surveyYear: number,
  title?: string,
  psaApprovalNo?: string,
): Promise<{ id: number; survey_year: number; title: string }> {
  const defaultTitle =
    title?.trim() ||
    (surveyYear === 2024 ? '2024 POPCEN-CBMS' : `${surveyYear} CBMS Survey`);
  const refDate = `${surveyYear}-07-01`;

  const res = await pool.query<{ id: number; survey_year: number; title: string }>(
    `
    INSERT INTO public.survey_years (survey_year, title, reference_date, psa_approval_no, is_active)
    VALUES ($1, $2, $3, $4, TRUE)
    ON CONFLICT (survey_year) DO UPDATE
    SET title = COALESCE(NULLIF($2, ''), public.survey_years.title)
    RETURNING id, survey_year, title;
    `,
    [surveyYear, defaultTitle, refDate, psaApprovalNo ?? 'PSA-2419-02-001'],
  );

  return res.rows[0]!;
}

export async function fetchEtlBatchesOverview(): Promise<{
  surveyYears: SurveyYearSummary[];
  batches: UploadBatchSummary[];
}> {
  const [yearsResult, batchesResult] = await Promise.all([
    sql<{
      id: number;
      survey_year: number;
      title: string;
      reference_date: string | null;
      psa_approval_no: string | null;
      is_active: boolean;
      household_count: string;
      member_count: string;
    }>`
      SELECT
        sy.id,
        sy.survey_year,
        sy.title,
        sy.reference_date::text AS reference_date,
        sy.psa_approval_no,
        sy.is_active,
        COALESCE(hh_agg.household_count, 0)::text AS household_count,
        COALESCE(hm_agg.member_count, 0)::text AS member_count
      FROM public.survey_years sy
      LEFT JOIN (
        SELECT survey_year_id, COUNT(*) AS household_count
        FROM public.households
        GROUP BY survey_year_id
      ) hh_agg ON hh_agg.survey_year_id = sy.id
      LEFT JOIN (
        SELECT survey_year_id, COUNT(*) AS member_count
        FROM public.household_members
        GROUP BY survey_year_id
      ) hm_agg ON hm_agg.survey_year_id = sy.id
      ORDER BY sy.survey_year DESC;
    `.execute(db),
    sql<{
      id: string;
      survey_year_id: number;
      survey_year: number;
      survey_title: string;
      uploaded_by: string | null;
      file_name: string;
      file_type: 'XLSX' | 'XLS' | 'CSV';
      file_size_bytes: string | null;
      status: UploadBatchSummary['status'];
      total_rows_read: number;
      households_imported: number;
      members_imported: number;
      error_log: EtlValidationWarning[] | string | null;
      uploaded_at: Date;
      completed_at: Date | null;
    }>`
      SELECT
        ub.id,
        ub.survey_year_id,
        sy.survey_year,
        sy.title AS survey_title,
        ub.uploaded_by,
        ub.file_name,
        ub.file_type,
        ub.file_size_bytes::text AS file_size_bytes,
        ub.status,
        ub.total_rows_read,
        ub.households_imported,
        ub.members_imported,
        ub.error_log,
        ub.uploaded_at,
        ub.completed_at
      FROM public.upload_batches ub
      JOIN public.survey_years sy ON sy.id = ub.survey_year_id
      ORDER BY ub.uploaded_at DESC
      LIMIT 25;
    `.execute(db),
  ]);

  const surveyYears: SurveyYearSummary[] = yearsResult.rows.map((r) => ({
    id: r.id,
    surveyYear: r.survey_year,
    title: r.title,
    referenceDate: r.reference_date,
    psaApprovalNo: r.psa_approval_no,
    isActive: r.is_active,
    householdCount: Number(r.household_count),
    memberCount: Number(r.member_count),
  }));

  const batches: UploadBatchSummary[] = batchesResult.rows.map((b) => ({
    id: b.id,
    surveyYearId: b.survey_year_id,
    surveyYear: b.survey_year,
    surveyTitle: b.survey_title,
    uploadedBy: b.uploaded_by,
    fileName: b.file_name,
    fileType: b.file_type,
    fileSizeBytes: b.file_size_bytes ? Number(b.file_size_bytes) : null,
    status: b.status,
    totalRowsRead: Number(b.total_rows_read),
    householdsImported: Number(b.households_imported),
    membersImported: Number(b.members_imported),
    errorLog: Array.isArray(b.error_log)
      ? b.error_log
      : typeof b.error_log === 'string'
        ? JSON.parse(b.error_log)
        : [],
    uploadedAt: new Date(b.uploaded_at).toISOString(),
    completedAt: b.completed_at ? new Date(b.completed_at).toISOString() : null,
  }));

  return { surveyYears, batches };
}

/**
 * GET /api/v1/etl/batches
 * Returns all Survey Years with live household/member counts and recent Upload Batches
 */
etlRouter.get('/batches', async (_req, res) => {
  try {
    const overview = await fetchEtlBatchesOverview();
    res.json(overview);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch upload batches',
      message: err instanceof Error ? err.message : 'Unknown database error',
    });
  }
});

/**
 * GET /api/v1/etl/batches/:id
 * Returns live status & progress counters for a single upload batch
 */
etlRouter.get('/batches/:id', async (req, res) => {
  const batchId = req.params.id;
  try {
    const result = await sql<{
      id: string;
      survey_year_id: number;
      survey_year: number;
      survey_title: string;
      uploaded_by: string | null;
      file_name: string;
      file_type: 'XLSX' | 'XLS' | 'CSV';
      file_size_bytes: string | null;
      status: UploadBatchSummary['status'];
      total_rows_read: number;
      households_imported: number;
      members_imported: number;
      error_log: EtlValidationWarning[] | string | null;
      uploaded_at: Date;
      completed_at: Date | null;
    }>`
      SELECT
        ub.id,
        ub.survey_year_id,
        sy.survey_year,
        sy.title AS survey_title,
        ub.uploaded_by,
        ub.file_name,
        ub.file_type,
        ub.file_size_bytes::text AS file_size_bytes,
        ub.status,
        ub.total_rows_read,
        ub.households_imported,
        ub.members_imported,
        ub.error_log,
        ub.uploaded_at,
        ub.completed_at
      FROM public.upload_batches ub
      JOIN public.survey_years sy ON sy.id = ub.survey_year_id
      WHERE ub.id = ${batchId}::uuid;
    `.execute(db);

    const b = result.rows[0];
    if (!b) {
      res.status(404).json({ error: 'Upload batch not found' });
      return;
    }

    const summary: UploadBatchSummary = {
      id: b.id,
      surveyYearId: b.survey_year_id,
      surveyYear: b.survey_year,
      surveyTitle: b.survey_title,
      uploadedBy: b.uploaded_by,
      fileName: b.file_name,
      fileType: b.file_type,
      fileSizeBytes: b.file_size_bytes ? Number(b.file_size_bytes) : null,
      status: b.status,
      totalRowsRead: Number(b.total_rows_read),
      householdsImported: Number(b.households_imported),
      membersImported: Number(b.members_imported),
      errorLog: Array.isArray(b.error_log)
        ? b.error_log
        : typeof b.error_log === 'string'
          ? JSON.parse(b.error_log)
          : [],
      uploadedAt: new Date(b.uploaded_at).toISOString(),
      completedAt: b.completed_at ? new Date(b.completed_at).toISOString() : null,
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to query batch status',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/etl/upload
 * Multipart file upload (.xlsx / .csv) -> Spawns CBMS 312-Column Worker Thread
 */
etlRouter.post('/upload', upload.single('file'), async (req, res) => {
  const role = resolveEffectiveRole(req as never);
  if (!hasFullDataAccess(role)) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.promises.unlink(req.file.path).catch(() => undefined);
    }
    res.status(403).json({
      error: 'Forbidden: STAFF role is not authorized to upload or modify CBMS survey datasets.',
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No CBMS file (.xlsx or .csv) provided in field "file".' });
    return;
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const fileType: 'XLSX' | 'XLS' | 'CSV' | null =
    ext === '.xlsx'
      ? 'XLSX'
      : ext === '.xls'
        ? 'XLS'
        : ext === '.csv'
          ? 'CSV'
          : null;

  if (!fileType) {
    fs.promises.unlink(req.file.path).catch(() => undefined);
    res.status(400).json({
      error: 'Unsupported file format. Please upload a .xlsx or .csv CBMS export.',
    });
    return;
  }

  const surveyYear = Number(req.body?.surveyYear ?? 2024);
  if (!Number.isInteger(surveyYear) || surveyYear < 2000 || surveyYear > 2100) {
    fs.promises.unlink(req.file.path).catch(() => undefined);
    res.status(400).json({ error: 'Invalid surveyYear (must be between 2000 and 2100).' });
    return;
  }

  const replaceExistingYearData =
    req.body?.replaceExisting === 'true' || req.body?.replaceExisting === true;

  try {
    const yearRow = await ensureSurveyYear(surveyYear, req.body?.surveyTitle);

    const insertRes = await pool.query<{ id: string }>(
      `
      INSERT INTO public.upload_batches (
        survey_year_id, file_name, file_type, file_size_bytes, status
      )
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING id;
      `,
      [yearRow.id, req.file.originalname, fileType, req.file.size],
    );

    const batchId = insertRes.rows[0]!.id;

    dispatchEtlJobInWorker({
      batchId,
      surveyYearId: yearRow.id,
      filePath: req.file.path,
      fileType,
      replaceExistingYearData,
      cleanupFileOnFinish: true,
    });

    res.status(202).json({
      batchId,
      surveyYear,
      fileName: req.file.originalname,
      status: 'PROCESSING',
    });
  } catch (err) {
    fs.promises.unlink(req.file.path).catch(() => undefined);
    res.status(500).json({
      error: 'Failed to initialize CBMS ETL batch',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/etl/import-workspace-sample
 * Runs the 312-Column Worker ETL directly on docs/CBMS_data.xlsx in the repository
 */
etlRouter.post('/import-workspace-sample', async (req, res) => {
  const role = resolveEffectiveRole(req as never);
  if (!hasFullDataAccess(role)) {
    res.status(403).json({
      error: 'Forbidden: STAFF role is not authorized to import CBMS survey datasets.',
    });
    return;
  }

  const candidatePaths = [
    path.resolve(process.cwd(), 'docs/CBMS_data.xlsx'),
    path.resolve(process.cwd(), '../../docs/CBMS_data.xlsx'),
  ];
  const sampleFilePath = candidatePaths.find((p) => fs.existsSync(p));
  if (!sampleFilePath) {
    res.status(404).json({ error: 'Workspace docs/CBMS_data.xlsx not found on server disk.' });
    return;
  }

  const surveyYear = Number(req.body?.surveyYear ?? 2024);
  const replaceExistingYearData = Boolean(req.body?.replaceExisting);

  try {
    const stat = fs.statSync(sampleFilePath);
    const yearRow = await ensureSurveyYear(surveyYear, req.body?.surveyTitle);

    const insertRes = await pool.query<{ id: string }>(
      `
      INSERT INTO public.upload_batches (
        survey_year_id, file_name, file_type, file_size_bytes, status
      )
      VALUES ($1, $2, 'XLSX', $3, 'PENDING')
      RETURNING id;
      `,
      [yearRow.id, 'CBMS_data.xlsx', stat.size],
    );

    const batchId = insertRes.rows[0]!.id;

    dispatchEtlJobInWorker({
      batchId,
      surveyYearId: yearRow.id,
      filePath: sampleFilePath,
      fileType: 'XLSX',
      replaceExistingYearData,
      cleanupFileOnFinish: false,
    });

    res.status(202).json({
      batchId,
      surveyYear,
      fileName: 'CBMS_data.xlsx',
      status: 'PROCESSING',
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to start workspace CBMS_data.xlsx ETL job',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/v1/etl/batches/:id
 * Rolls back / removes households imported by a specific batch (or clears the batch's survey year)
 * and refreshes mv_barangay_yearly_indicators.
 */
etlRouter.delete('/batches/:id', async (req, res) => {
  const role = resolveEffectiveRole(req as never);
  if (!hasFullDataAccess(role)) {
    res.status(403).json({
      error: 'Forbidden: STAFF role cannot rollback CBMS survey batches.',
    });
    return;
  }

  const batchId = req.params.id;
  try {
    const delRes = await pool.query(
      `DELETE FROM public.households WHERE upload_batch_id = $1::uuid`,
      [batchId],
    );

    await pool.query(
      `
      UPDATE public.upload_batches
      SET status = 'ROLLED_BACK', completed_at = NOW()
      WHERE id = $1::uuid;
      `,
      [batchId],
    );

    try {
      await pool.query(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_barangay_yearly_indicators;`,
      );
    } catch {
      await pool.query(`REFRESH MATERIALIZED VIEW public.mv_barangay_yearly_indicators;`);
    }

    res.json({
      batchId,
      status: 'ROLLED_BACK',
      householdsRemoved: delRes.rowCount ?? 0,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to rollback upload batch',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/v1/etl/years/:surveyYear
 * Clears all households for a given Survey Year (restoring the 0-household state)
 * and refreshes mv_barangay_yearly_indicators.
 */
etlRouter.delete('/years/:surveyYear', async (req, res) => {
  const role = resolveEffectiveRole(req as never);
  if (!hasFullDataAccess(role)) {
    res.status(403).json({
      error: 'Forbidden: STAFF role cannot clear survey year datasets.',
    });
    return;
  }

  const surveyYear = Number(req.params.surveyYear);
  try {
    const yearRes = await pool.query<{ id: number }>(
      `SELECT id FROM public.survey_years WHERE survey_year = $1`,
      [surveyYear],
    );
    const yearId = yearRes.rows[0]?.id;
    if (!yearId) {
      res.json({ surveyYear, householdsRemoved: 0 });
      return;
    }

    const delRes = await pool.query(
      `DELETE FROM public.households WHERE survey_year_id = $1`,
      [yearId],
    );

    await pool.query(
      `
      UPDATE public.upload_batches
      SET status = 'ROLLED_BACK', completed_at = NOW()
      WHERE survey_year_id = $1 AND status = 'COMPLETED';
      `,
      [yearId],
    );

    try {
      await pool.query(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_barangay_yearly_indicators;`,
      );
    } catch {
      await pool.query(`REFRESH MATERIALIZED VIEW public.mv_barangay_yearly_indicators;`);
    }

    res.json({
      surveyYear,
      householdsRemoved: delRes.rowCount ?? 0,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to clear survey year dataset',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});
