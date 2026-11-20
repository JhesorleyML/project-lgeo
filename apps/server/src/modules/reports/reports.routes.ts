import { Router } from 'express';
import {
  CBMS_REPORT_DIMENSIONS,
  CBMS_REPORT_INDICATORS,
  ReportFilterQuerySchema,
  canExportReportType,
  type UserRole,
} from '@cbms/shared';
import {
  executeReportQuery,
  generateCsvReportString,
  generateExcelReportBuffer,
} from './reports.service.js';

export const reportsRouter = Router();

export function resolveReportUserRole(req: {
  user?: { role: UserRole };
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}): UserRole {
  if (req.user?.role) return req.user.role;
  const headerRole = String(req.headers['x-cbms-role'] ?? '').trim().toUpperCase();
  if (
    headerRole === 'ADMIN' ||
    headerRole === 'MUNICIPAL_STATISTICIAN' ||
    headerRole === 'MPDC' ||
    headerRole === 'STAFF'
  ) {
    return headerRole;
  }
  const queryRole = String(req.query?.role ?? '').trim().toUpperCase();
  if (
    queryRole === 'ADMIN' ||
    queryRole === 'MUNICIPAL_STATISTICIAN' ||
    queryRole === 'MPDC' ||
    queryRole === 'STAFF'
  ) {
    return queryRole;
  }
  return 'STAFF';
}

/**
 * GET /api/v1/reports/metadata
 * Returns the 8 CBMS Report Dimensions and 43+ Whitelisted Indicators covering all 15 Sections (A-O + Poverty)
 */
reportsRouter.get('/metadata', (_req, res) => {
  res.json({
    dimensions: CBMS_REPORT_DIMENSIONS,
    indicators: CBMS_REPORT_INDICATORS,
  });
});

/**
 * GET /api/v1/reports/preview
 * Evaluates multi-dimension CBMS filters and returns live summary KPIs + preview rows.
 * Tiered RBAC:
 * - STAFF is allowed on BARANGAY_SUMMARY and HOUSEHOLD_ROSTER (household-level data only; member-level data is stripped).
 * - MEMBER_ROSTER requires ADMIN, MUNICIPAL_STATISTICIAN, or MPDC.
 */
reportsRouter.get('/preview', async (req, res) => {
  const parsed = ReportFilterQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid report filter parameters',
      details: parsed.error.flatten(),
    });
    return;
  }

  const query = parsed.data;
  const role = resolveReportUserRole(req as never);

  if (!canExportReportType(role, query.reportType)) {
    res.status(403).json({
      error: 'Forbidden under RA 10173 (Data Privacy Act of 2012)',
      message: `Role '${role}' is authorized to generate Barangay Summary (BARANGAY_SUMMARY) and Household-Level Roster (HOUSEHOLD_ROSTER) reports only. Individual Household Member Rosters (${query.reportType}) require ADMIN, MUNICIPAL_STATISTICIAN, or MPDC clearance.`,
      allowedReportTypes: ['BARANGAY_SUMMARY', 'HOUSEHOLD_ROSTER'],
    });
    return;
  }

  try {
    const previewData = await executeReportQuery(query, false, role);
    res.json(previewData);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to generate CBMS report preview',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/reports/export
 * Generates and downloads an Excel (.xlsx) or CSV (.csv) CBMS Report based on active filters.
 */
reportsRouter.get('/export', async (req, res) => {
  const parsed = ReportFilterQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid report export parameters',
      details: parsed.error.flatten(),
    });
    return;
  }

  const query = parsed.data;
  const role = resolveReportUserRole(req as never);

  if (!canExportReportType(role, query.reportType)) {
    res.status(403).json({
      error: 'Forbidden under RA 10173 (Data Privacy Act of 2012)',
      message: `Role '${role}' is authorized to export Barangay Summary (BARANGAY_SUMMARY) and Household-Level Roster (HOUSEHOLD_ROSTER) reports only. Individual Household Member exports (${query.reportType}) require ADMIN, MUNICIPAL_STATISTICIAN, or MPDC clearance.`,
      allowedReportTypes: ['BARANGAY_SUMMARY', 'HOUSEHOLD_ROSTER'],
    });
    return;
  }

  try {
    const fullData = await executeReportQuery(query, true, role);
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const brgySlug = query.barangayGeoCode === 'ALL' ? 'AllBarangays' : query.barangayGeoCode;
    const baseFilename = `CBMS_${query.surveyYear}_${query.reportType}_SanJose_${brgySlug}_${dateStamp}`;

    if (query.format === 'csv') {
      const csvString = await generateCsvReportString(fullData, query, role);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${baseFilename}.csv"`,
      );
      res.status(200).send(csvString);
      return;
    }

    const xlsxBuffer = await generateExcelReportBuffer(fullData, query, role);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseFilename}.xlsx"`,
    );
    res.status(200).send(xlsxBuffer);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to export CBMS report file',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});
