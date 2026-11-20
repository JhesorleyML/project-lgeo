import fs from 'node:fs';
import ExcelJS from 'exceljs';
import fastCsv from 'fast-csv';
import type pg from 'pg';
import type { EtlValidationWarning } from '@cbms/shared';
import { pool } from '../../db/kysely.js';
import {
  buildHeaderIndexMap,
  HOUSEHOLD_ASSETS_COLS,
  HOUSEHOLD_CONNECTIVITY_SAFETY_COLS,
  HOUSEHOLD_DISASTER_SHOCKS_COLS,
  HOUSEHOLD_FINANCIAL_ACCOUNTS_COLS,
  HOUSEHOLD_FOOD_SECURITY_COLS,
  HOUSEHOLD_HEALTH_COLS,
  HOUSEHOLD_HOUSING_COLS,
  HOUSEHOLD_POVERTY_COLS,
  HOUSEHOLD_SOCIAL_PROTECTION_COLS,
  HOUSEHOLD_WASH_COLS,
  isCbmsHeaderRow,
  MEMBER_DEMO_CORE_COLS,
  MEMBER_DEMO_OTHER_COLS,
  MEMBER_ECONOMICS_COLS,
  MEMBER_EDUCATION_COLS,
  MEMBER_MIGRATION_COLS,
  parseCbms312Row,
  type ParsedHouseholdPayload,
  type ParsedMemberPayload,
} from './cbms-column-mapper.js';

export interface EtlJobInput {
  batchId: string;
  surveyYearId: number;
  filePath: string;
  fileType: 'XLSX' | 'XLS' | 'CSV';
  replaceExistingYearData?: boolean;
  cleanupFileOnFinish?: boolean;
}

export interface EtlJobResult {
  batchId: string;
  totalRowsRead: number;
  householdsImported: number;
  membersImported: number;
  warningsCount: number;
}

const CHUNK_ROW_SIZE = 1000;
const SQL_SUB_BATCH_SIZE = 350; // Keeps bind params <= 350 * 33 = 11,550 (well below PG 65,535 limit)
const MAX_STORED_WARNINGS = 150;

/**
 * Builds and executes a parameterized multi-row INSERT ... ON CONFLICT DO UPDATE statement.
 */
async function executeBulkSectionUpsert(
  client: pg.PoolClient,
  tableName: string,
  pkColumn: 'household_id' | 'member_id',
  domainColumns: readonly string[],
  rows: Array<{ fkId: string; data: Record<string, unknown> }>,
): Promise<void> {
  if (rows.length === 0) return;

  const allCols = [pkColumn, ...domainColumns];
  const colListSql = allCols.map((c) => `"${c}"`).join(', ');
  const updateSetSql = domainColumns.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');

  for (let offset = 0; offset < rows.length; offset += SQL_SUB_BATCH_SIZE) {
    const slice = rows.slice(offset, offset + SQL_SUB_BATCH_SIZE);
    const values: unknown[] = [];
    const rowPlaceholders: string[] = [];
    let paramIdx = 1;

    for (const item of slice) {
      const placeholders: string[] = [`$${paramIdx++}`];
      values.push(item.fkId);
      for (const col of domainColumns) {
        placeholders.push(`$${paramIdx++}`);
        values.push(item.data[col] ?? null);
      }
      rowPlaceholders.push(`(${placeholders.join(', ')})`);
    }

    const sqlText = `
      INSERT INTO public."${tableName}" (${colListSql})
      VALUES ${rowPlaceholders.join(', ')}
      ON CONFLICT ("${pkColumn}") DO UPDATE
      SET ${updateSetSql};
    `;

    await client.query(sqlText, values);
  }
}

/**
 * Ensures PSGC parent rows (regions, provinces, cities_municipalities, barangays) exist before inserting households.
 */
async function ensurePsgcHierarchy(
  client: pg.PoolClient,
  households: ParsedHouseholdPayload[],
): Promise<void> {
  if (households.length === 0) return;

  const regions = new Map<string, string>();
  const provinces = new Map<string, { regionCode: string; provinceCode: string }>();
  const cities = new Map<
    string,
    { provinceGeoCode: string; regionCode: string; provinceCode: string; cityMunCode: string; name: string }
  >();
  const barangays = new Map<
    string,
    { cityMunGeoCode: string; barangayCode: string; name: string }
  >();

  for (const hh of households) {
    const regCode = hh.region_code || '16';
    const provCode = hh.province_code || '085';
    const provGeoCode = `${regCode}${provCode}`;

    regions.set(regCode, `Region ${regCode}`);
    provinces.set(provGeoCode, { regionCode: regCode, provinceCode: provCode });
    cities.set(hh.city_mun_geo_code, {
      provinceGeoCode: provGeoCode,
      regionCode: regCode,
      provinceCode: provCode,
      cityMunCode: hh.city_mun_code || '06',
      name: hh.city_mun_name || 'San Jose, Dinagat Islands',
    });
    barangays.set(hh.barangay_geo_code, {
      cityMunGeoCode: hh.city_mun_geo_code,
      barangayCode: hh.barangay_code || hh.barangay_geo_code.slice(-3),
      name: hh.barangay_name || 'Barangay',
    });
  }

  for (const [regionCode, name] of regions) {
    await client.query(
      `INSERT INTO public.regions (region_code, name) VALUES ($1, $2) ON CONFLICT (region_code) DO NOTHING`,
      [regionCode, name],
    );
  }

  for (const [provGeoCode, p] of provinces) {
    await client.query(
      `INSERT INTO public.provinces (province_geo_code, region_code, province_code, name)
       VALUES ($1, $2, $3, $4) ON CONFLICT (province_geo_code) DO NOTHING`,
      [provGeoCode, p.regionCode, p.provinceCode, `Province ${p.provinceCode}`],
    );
  }

  for (const [cityMunGeoCode, c] of cities) {
    await client.query(
      `INSERT INTO public.cities_municipalities (
         city_mun_geo_code, province_geo_code, region_code, province_code, city_mun_code, name
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (city_mun_geo_code) DO NOTHING`,
      [
        cityMunGeoCode,
        c.provinceGeoCode,
        c.regionCode,
        c.provinceCode,
        c.cityMunCode,
        c.name,
      ],
    );
  }

  for (const [brgyGeoCode, b] of barangays) {
    await client.query(
      `INSERT INTO public.barangays (barangay_geo_code, city_mun_geo_code, barangay_code, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (barangay_geo_code) DO NOTHING`,
      [brgyGeoCode, b.cityMunGeoCode, b.barangayCode, b.name],
    );
  }
}

/**
 * Flushes a chunk of parsed households and members across all 17 normalized tables inside a single transaction.
 */
async function flushChunkToDatabase(
  client: pg.PoolClient,
  batchId: string,
  surveyYearId: number,
  newHouseholds: ParsedHouseholdPayload[],
  members: ParsedMemberPayload[],
  householdUuidToDbId: Map<string, string>,
): Promise<void> {
  if (newHouseholds.length === 0 && members.length === 0) return;

  await client.query('BEGIN');
  try {
    // 1. Ensure PSGC parent foreign keys exist
    await ensurePsgcHierarchy(client, newHouseholds);

    // 2. Bulk upsert new households in this chunk + their 10 1:1 section tables
    if (newHouseholds.length > 0) {
      const hhCols = [
        'survey_year_id',
        'upload_batch_id',
        'cbms_uuid',
        'map_uuid',
        'city_mun_geo_code',
        'barangay_geo_code',
        'city_mun_name',
        'barangay_name',
        'region_code',
        'province_code',
        'city_mun_code',
        'barangay_code',
        'husn',
        'hsn',
        'longitude',
        'latitude',
        'hh_size',
        'number_of_males',
        'number_of_females',
        'number_of_nuclear_families',
        'respondent_line_number',
        'agree_to_sign_the_waiver',
        'reason_for_not_signing_the_waiver',
        'address_house_number',
        'address_floor_number',
        'address_block_or_lot_number',
        'address_street_name',
        'address_subdivision_or_village',
        'address_sitio_purok',
        'proximity_health_center',
        'proximity_hospital',
        'overcrowding_status',
      ] as const;

      const updateCols = hhCols.filter((c) => c !== 'survey_year_id' && c !== 'cbms_uuid');
      const updateSetSql = updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');

      for (let offset = 0; offset < newHouseholds.length; offset += SQL_SUB_BATCH_SIZE) {
        const slice = newHouseholds.slice(offset, offset + SQL_SUB_BATCH_SIZE);
        const values: unknown[] = [];
        const rowPlaceholders: string[] = [];
        let p = 1;

        for (const hh of slice) {
          rowPlaceholders.push(
            `(${hhCols.map(() => `$${p++}`).join(', ')})`,
          );
          values.push(
            surveyYearId,
            batchId,
            hh.cbms_uuid,
            hh.map_uuid,
            hh.city_mun_geo_code,
            hh.barangay_geo_code,
            hh.city_mun_name,
            hh.barangay_name,
            hh.region_code,
            hh.province_code,
            hh.city_mun_code,
            hh.barangay_code,
            hh.husn,
            hh.hsn,
            hh.longitude,
            hh.latitude,
            hh.hh_size,
            hh.number_of_males,
            hh.number_of_females,
            hh.number_of_nuclear_families,
            hh.respondent_line_number,
            hh.agree_to_sign_the_waiver,
            hh.reason_for_not_signing_the_waiver,
            hh.address_house_number,
            hh.address_floor_number,
            hh.address_block_or_lot_number,
            hh.address_street_name,
            hh.address_subdivision_or_village,
            hh.address_sitio_purok,
            hh.proximity_health_center,
            hh.proximity_hospital,
            hh.overcrowding_status,
          );
        }

        const insertedHh = await client.query<{ id: string; cbms_uuid: string }>(
          `
          INSERT INTO public.households (${hhCols.map((c) => `"${c}"`).join(', ')})
          VALUES ${rowPlaceholders.join(', ')}
          ON CONFLICT (survey_year_id, cbms_uuid) DO UPDATE
          SET ${updateSetSql}
          RETURNING id, cbms_uuid;
          `,
          values,
        );

        for (const row of insertedHh.rows) {
          householdUuidToDbId.set(row.cbms_uuid.toLowerCase(), row.id);
        }
      }

      // Prepare 10 Household Section table payloads
      const buildHhSectionRows = (
        secKey: keyof ParsedHouseholdPayload['sections'],
      ): Array<{ fkId: string; data: Record<string, unknown> }> => {
        const list: Array<{ fkId: string; data: Record<string, unknown> }> = [];
        for (const hh of newHouseholds) {
          const fkId = householdUuidToDbId.get(hh.cbms_uuid.toLowerCase());
          if (fkId) {
            list.push({ fkId, data: hh.sections[secKey] });
          }
        }
        return list;
      };

      await executeBulkSectionUpsert(
        client,
        'household_health',
        'household_id',
        HOUSEHOLD_HEALTH_COLS,
        buildHhSectionRows('household_health'),
      );
      await executeBulkSectionUpsert(
        client,
        'household_food_security',
        'household_id',
        HOUSEHOLD_FOOD_SECURITY_COLS,
        buildHhSectionRows('household_food_security'),
      );
      await executeBulkSectionUpsert(
        client,
        'household_connectivity_safety',
        'household_id',
        HOUSEHOLD_CONNECTIVITY_SAFETY_COLS,
        buildHhSectionRows('household_connectivity_safety'),
      );
      await executeBulkSectionUpsert(
        client,
        'household_financial_accounts',
        'household_id',
        HOUSEHOLD_FINANCIAL_ACCOUNTS_COLS,
        buildHhSectionRows('household_financial_accounts'),
      );
      await executeBulkSectionUpsert(
        client,
        'household_disaster_shocks',
        'household_id',
        HOUSEHOLD_DISASTER_SHOCKS_COLS,
        buildHhSectionRows('household_disaster_shocks'),
      );
      await executeBulkSectionUpsert(
        client,
        'household_social_protection',
        'household_id',
        HOUSEHOLD_SOCIAL_PROTECTION_COLS,
        buildHhSectionRows('household_social_protection'),
      );
      await executeBulkSectionUpsert(
        client,
        'household_wash',
        'household_id',
        HOUSEHOLD_WASH_COLS,
        buildHhSectionRows('household_wash'),
      );
      await executeBulkSectionUpsert(
        client,
        'household_housing',
        'household_id',
        HOUSEHOLD_HOUSING_COLS,
        buildHhSectionRows('household_housing'),
      );
      await executeBulkSectionUpsert(
        client,
        'household_assets',
        'household_id',
        HOUSEHOLD_ASSETS_COLS,
        buildHhSectionRows('household_assets'),
      );
      await executeBulkSectionUpsert(
        client,
        'household_poverty',
        'household_id',
        HOUSEHOLD_POVERTY_COLS,
        buildHhSectionRows('household_poverty'),
      );
    }

    // 3. Bulk upsert household_members + 5 Member Section tables (Sections A–E)
    if (members.length > 0) {
      // Deduplicate by (household_id, line_number) within the chunk just in case
      const dedupedMembersMap = new Map<
        string,
        { householdId: string; member: ParsedMemberPayload }
      >();
      for (const m of members) {
        const hhId = householdUuidToDbId.get(m.cbms_uuid.toLowerCase());
        if (!hhId) continue;
        dedupedMembersMap.set(`${hhId}:${m.line_number}`, {
          householdId: hhId,
          member: m,
        });
      }

      const validMembers = [...dedupedMembersMap.values()];
      const memberKeyToDbId = new Map<string, string>();

      for (let offset = 0; offset < validMembers.length; offset += SQL_SUB_BATCH_SIZE) {
        const slice = validMembers.slice(offset, offset + SQL_SUB_BATCH_SIZE);
        const values: unknown[] = [];
        const rowPlaceholders: string[] = [];
        let p = 1;

        for (const item of slice) {
          const m = item.member;
          rowPlaceholders.push(
            `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`,
          );
          values.push(
            item.householdId,
            surveyYearId,
            m.line_number,
            m.city_mun_geo_code_x,
            m.barangay_geo_code_x,
            m.city_mun_x,
            m.barangay_x,
            m.husn_x,
            m.hsn_x,
          );
        }

        const insertedMembers = await client.query<{
          id: string;
          household_id: string;
          line_number: string;
        }>(
          `
          INSERT INTO public.household_members (
            household_id, survey_year_id, line_number,
            city_mun_geo_code_x, barangay_geo_code_x,
            city_mun_x, barangay_x, husn_x, hsn_x
          )
          VALUES ${rowPlaceholders.join(', ')}
          ON CONFLICT (household_id, line_number) DO UPDATE
          SET
            survey_year_id = EXCLUDED.survey_year_id,
            city_mun_geo_code_x = EXCLUDED.city_mun_geo_code_x,
            barangay_geo_code_x = EXCLUDED.barangay_geo_code_x,
            city_mun_x = EXCLUDED.city_mun_x,
            barangay_x = EXCLUDED.barangay_x,
            husn_x = EXCLUDED.husn_x,
            hsn_x = EXCLUDED.hsn_x
          RETURNING id, household_id, line_number;
          `,
          values,
        );

        for (const row of insertedMembers.rows) {
          memberKeyToDbId.set(`${row.household_id}:${row.line_number}`, row.id);
        }
      }

      const buildMemberSectionRows = (
        secKey: keyof ParsedMemberPayload['sections'],
      ): Array<{ fkId: string; data: Record<string, unknown> }> => {
        const list: Array<{ fkId: string; data: Record<string, unknown> }> = [];
        for (const item of validMembers) {
          const fkId = memberKeyToDbId.get(
            `${item.householdId}:${item.member.line_number}`,
          );
          if (fkId) {
            list.push({ fkId, data: item.member.sections[secKey] });
          }
        }
        return list;
      };

      await executeBulkSectionUpsert(
        client,
        'member_demographics_core',
        'member_id',
        MEMBER_DEMO_CORE_COLS,
        buildMemberSectionRows('member_demographics_core'),
      );
      await executeBulkSectionUpsert(
        client,
        'member_demographics_other',
        'member_id',
        MEMBER_DEMO_OTHER_COLS,
        buildMemberSectionRows('member_demographics_other'),
      );
      await executeBulkSectionUpsert(
        client,
        'member_migration',
        'member_id',
        MEMBER_MIGRATION_COLS,
        buildMemberSectionRows('member_migration'),
      );
      await executeBulkSectionUpsert(
        client,
        'member_education',
        'member_id',
        MEMBER_EDUCATION_COLS,
        buildMemberSectionRows('member_education'),
      );
      await executeBulkSectionUpsert(
        client,
        'member_economics',
        'member_id',
        MEMBER_ECONOMICS_COLS,
        buildMemberSectionRows('member_economics'),
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * Streams a 312-column CBMS .xlsx or .csv file, normalizes into 17 relational tables,
 * runs spatial containment verification, and refreshes mv_barangay_yearly_indicators.
 */
export async function runCbmsEtlJob(job: EtlJobInput): Promise<EtlJobResult> {
  const client = await pool.connect();

  let totalRowsRead = 0;
  let membersImported = 0;
  const householdUuidToDbId = new Map<string, string>();
  const allWarnings: EtlValidationWarning[] = [];

  try {
    await client.query(
      `UPDATE public.upload_batches SET status = 'PROCESSING', uploaded_at = NOW() WHERE id = $1`,
      [job.batchId],
    );

    if (job.replaceExistingYearData) {
      await client.query(`DELETE FROM public.households WHERE survey_year_id = $1`, [
        job.surveyYearId,
      ]);
    }

    let headerMap: Map<string, number> | null = null;
    let pendingHouseholds: ParsedHouseholdPayload[] = [];
    let pendingMembers: ParsedMemberPayload[] = [];
    const pendingHouseholdSet = new Set<string>();

    const flushPendingIfNeeded = async (force = false) => {
      if (!force && pendingMembers.length < CHUNK_ROW_SIZE) return;
      if (pendingHouseholds.length === 0 && pendingMembers.length === 0) return;

      const hhBatch = pendingHouseholds;
      const memBatch = pendingMembers;
      pendingHouseholds = [];
      pendingMembers = [];
      pendingHouseholdSet.clear();

      await flushChunkToDatabase(
        client,
        job.batchId,
        job.surveyYearId,
        hhBatch,
        memBatch,
        householdUuidToDbId,
      );

      membersImported += memBatch.length;

      await client.query(
        `
        UPDATE public.upload_batches
        SET
          total_rows_read = $2,
          households_imported = $3,
          members_imported = $4,
          error_log = $5::jsonb
        WHERE id = $1;
        `,
        [
          job.batchId,
          totalRowsRead,
          householdUuidToDbId.size,
          membersImported,
          JSON.stringify(allWarnings.slice(0, MAX_STORED_WARNINGS)),
        ],
      );
    };

    const handleRawRow = (cells: unknown[], rowNumber: number) => {
      if (!cells || cells.length === 0) return;
      if (!headerMap) {
        if (isCbmsHeaderRow(cells)) {
          headerMap = buildHeaderIndexMap(cells);
        }
        return;
      }

      // Skip completely empty rows
      const firstCell = cells[0];
      if (firstCell === null || firstCell === undefined || String(firstCell).trim() === '') {
        return;
      }

      totalRowsRead++;
      const rawUuid = String(firstCell).trim().toLowerCase();
      const alreadySeen =
        householdUuidToDbId.has(rawUuid) || pendingHouseholdSet.has(rawUuid);

      const parsed = parseCbms312Row(cells, headerMap, rowNumber, !alreadySeen);

      if (parsed.warnings.length > 0 && allWarnings.length < MAX_STORED_WARNINGS) {
        allWarnings.push(...parsed.warnings);
      }

      if (parsed.household) {
        pendingHouseholds.push(parsed.household);
        pendingHouseholdSet.add(parsed.household.cbms_uuid);
      }
      if (parsed.member) {
        pendingMembers.push(parsed.member);
      }
    };

    if (job.fileType === 'CSV') {
      await new Promise<void>((resolve, reject) => {
        let rowNum = 0;
        const stream = fs
          .createReadStream(job.filePath)
          .pipe(fastCsv.parse({ headers: false, ignoreEmpty: true }));

        stream.on('error', reject);
        stream.on('data', async (row: unknown[]) => {
          rowNum++;
          handleRawRow(row, rowNum);
          if (pendingMembers.length >= CHUNK_ROW_SIZE) {
            stream.pause();
            try {
              await flushPendingIfNeeded(true);
              stream.resume();
            } catch (err) {
              stream.destroy(err as Error);
            }
          }
        });
        stream.on('end', () => resolve());
      });
    } else {
      // Stream .xlsx using ExcelJS WorkbookReader event stream (compatible with exceljs 3.4+)
      interface StreamWorksheet {
        on: (
          event: 'row' | 'finished',
          listener: (row: { values?: unknown[] }) => void,
        ) => void;
      }
      interface StreamWorkbookReader {
        on: (
          event: 'error' | 'worksheet' | 'end',
          listener: (arg: unknown) => void,
        ) => void;
        read: (filePath: string, options: Record<string, unknown>) => void;
      }
      const WorkbookReaderCtor = (
        ExcelJS.stream.xlsx as unknown as {
          WorkbookReader: new () => StreamWorkbookReader;
        }
      ).WorkbookReader;

      const parsedRows: Array<{ cells: unknown[]; rowNum: number }> = [];
      await new Promise<void>((resolve, reject) => {
        const reader = new WorkbookReaderCtor();
        let firstWorksheetProcessed = false;
        let rowNum = 0;

        reader.on('error', (err) => reject(err));
        reader.on('worksheet', (wsArg) => {
          if (firstWorksheetProcessed) return;
          const worksheet = wsArg as StreamWorksheet;
          worksheet.on('row', (row: { values?: unknown[] }) => {
            rowNum++;
            const rawVals = row.values;
            if (!Array.isArray(rawVals) || rawVals.length <= 1) return;
            // ExcelJS row.values is 1-indexed (index 0 is undefined)
            parsedRows.push({ cells: rawVals.slice(1), rowNum });
          });
          worksheet.on('finished', () => {
            firstWorksheetProcessed = true;
          });
        });
        reader.on('end', () => resolve());
        reader.read(job.filePath, {
          entries: 'emit',
          sharedStrings: 'cache',
          styles: 'ignore',
          hyperlinks: 'ignore',
          worksheets: 'emit',
        });
      });

      for (const item of parsedRows) {
        handleRawRow(item.cells, item.rowNum);
        if (pendingMembers.length >= CHUNK_ROW_SIZE) {
          await flushPendingIfNeeded(true);
        }
      }
    }

    if (!headerMap) {
      throw new Error(
        'Could not locate a valid 312-column CBMS header row (starting with "uuid" and containing "line_number").',
      );
    }

    // Flush remaining rows
    await flushPendingIfNeeded(true);

    // Post-import Spatial Containment Check (Guardrail 4.2.1: ST_Intersects against barangays.geom_boundary)
    const driftAudit = await client.query<{ drifted_count: string }>(
      `
      SELECT COUNT(*)::text AS drifted_count
      FROM public.households h
      JOIN public.barangays b ON b.barangay_geo_code = h.barangay_geo_code
      WHERE h.upload_batch_id = $1
        AND h.geom_point IS NOT NULL
        AND b.geom_boundary IS NOT NULL
        AND NOT ST_Intersects(b.geom_boundary, h.geom_point);
      `,
      [job.batchId],
    );

    const driftedCount = Number(driftAudit.rows[0]?.drifted_count ?? 0);
    if (driftedCount > 0) {
      allWarnings.unshift({
        code: 'SPATIAL_BOUNDARY_DRIFT_AUDIT',
        message: `${driftedCount} household GPS points fall outside their declared barangay polygon boundary (flagged for Municipal Statistician review).`,
      });
    }

    // Refresh Materialized View CONCURRENTLY for sub-second Barangay Choropleth serving
    try {
      await client.query(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_barangay_yearly_indicators;`,
      );
    } catch {
      await client.query(`REFRESH MATERIALIZED VIEW public.mv_barangay_yearly_indicators;`);
    }

    await client.query(
      `
      UPDATE public.upload_batches
      SET
        status = 'COMPLETED',
        total_rows_read = $2,
        households_imported = $3,
        members_imported = $4,
        error_log = $5::jsonb,
        completed_at = NOW()
      WHERE id = $1;
      `,
      [
        job.batchId,
        totalRowsRead,
        householdUuidToDbId.size,
        membersImported,
        JSON.stringify(allWarnings.slice(0, MAX_STORED_WARNINGS)),
      ],
    );

    return {
      batchId: job.batchId,
      totalRowsRead,
      householdsImported: householdUuidToDbId.size,
      membersImported,
      warningsCount: allWarnings.length,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown ETL error';
    allWarnings.unshift({
      code: 'ETL_FATAL_ERROR',
      message: errorMsg,
    });
    await client
      .query(
        `
        UPDATE public.upload_batches
        SET
          status = 'FAILED',
          total_rows_read = $2,
          households_imported = $3,
          members_imported = $4,
          error_log = $5::jsonb,
          completed_at = NOW()
        WHERE id = $1;
        `,
        [
          job.batchId,
          totalRowsRead,
          householdUuidToDbId.size,
          membersImported,
          JSON.stringify(allWarnings.slice(0, MAX_STORED_WARNINGS)),
        ],
      )
      .catch(() => undefined);
    throw err;
  } finally {
    client.release();
    if (job.cleanupFileOnFinish && fs.existsSync(job.filePath)) {
      fs.promises.unlink(job.filePath).catch(() => undefined);
    }
  }
}
