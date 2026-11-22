import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CBMS_REPORT_DIMENSIONS,
  CBMS_REPORT_INDICATORS,
  CBMS_SECTIONS,
   REPORT_INDICATOR_MAP,
  ReportFilterQuerySchema,
  canAccessHouseholdData,
  canAccessMemberData,
  canExportReportType,
  getRequiredTablesForIndicators,
} from '@cbms/shared';
import {
  buildSampleReportData,
  generateCsvReportString,
  generateExcelReportBuffer,
  getHouseholdIndicatorSqlPredicate,
  getMemberIndicatorSqlPredicate,
  sanitizeHouseholdRowForRole,
} from '../reports.service.js';
import { resolveReportUserRole } from '../reports.routes.js';

describe('CBMS 8-Dimension Report Engine, Selective Section Joins & Tiered RBAC', () => {
  it('covers all 8 CBMS Dimensions and all 15 CBMS Sections (A-O + Poverty) in the indicator catalog', () => {
    assert.equal(CBMS_REPORT_DIMENSIONS.length, 8);
    assert.ok(CBMS_REPORT_INDICATORS.length >= 40);

    // Verify every single CBMS section code (A through O + Poverty) is represented in the report indicators
    const coveredSectionCodes = new Set(
      CBMS_REPORT_INDICATORS.map((ind) => ind.sectionCode),
    );
    for (const sec of CBMS_SECTIONS) {
      assert.equal(
        coveredSectionCodes.has(sec.code),
        true,
        `Expected CBMS Section ${sec.code} (${sec.tableName}) to be covered in CBMS_REPORT_INDICATORS`,
      );
    }

    // Verify every indicator produces a valid non-empty SQL predicate
    for (const ind of CBMS_REPORT_INDICATORS) {
      const sqlPred = getHouseholdIndicatorSqlPredicate(ind.id);
      assert.ok(
        sqlPred.length > 10,
        `Expected valid SQL predicate for indicator ${ind.id}`,
      );
      if (ind.level === 'MEMBER') {
        assert.ok(
          sqlPred.includes('EXISTS (SELECT 1 FROM public.household_members'),
          `Expected MEMBER-level indicator ${ind.id} to use an EXISTS semijoin`,
        );
      }
    }
  });

  it('prunes unused CBMS section joins based on active filter criteria (AGENTS.md §5)', () => {
    // Only Education (Out-of-School Youth) and Social Protection (4Ps) selected
    const pruned1 = getRequiredTablesForIndicators([
      'out_of_school_youth',
      'beneficiary_4ps',
    ]);
    assert.deepEqual(
      Array.from(pruned1.householdTables),
      ['household_social_protection'],
    );
    assert.deepEqual(
      Array.from(pruned1.memberTables).sort(),
      ['member_demographics_core', 'member_education'],
    );
    // Unused tables like household_assets or member_migration are NOT joined
    assert.equal(pruned1.householdTables.has('household_assets'), false);
    assert.equal(pruned1.memberTables.has('member_migration'), false);
  });

  it('enforces tiered RBAC: STAFF allowed on BARANGAY_SUMMARY and HOUSEHOLD_ROSTER (household-level data), blocked on MEMBER_ROSTER (member-level data)', async () => {
    // STAFF has household-level data access, but NOT individual member-level data access
    assert.equal(canAccessHouseholdData('STAFF'), true);
    assert.equal(canAccessMemberData('STAFF'), false);
    assert.equal(canExportReportType('STAFF', 'BARANGAY_SUMMARY'), true);
    assert.equal(canExportReportType('STAFF', 'HOUSEHOLD_ROSTER'), true);
    assert.equal(canExportReportType('STAFF', 'MEMBER_ROSTER'), false);

    // ADMIN, MUNICIPAL_STATISTICIAN, and MPDC have full access to both household and member data
    for (const role of ['ADMIN', 'MUNICIPAL_STATISTICIAN', 'MPDC'] as const) {
      assert.equal(canAccessHouseholdData(role), true);
      assert.equal(canAccessMemberData(role), true);
      assert.equal(canExportReportType(role, 'BARANGAY_SUMMARY'), true);
      assert.equal(canExportReportType(role, 'HOUSEHOLD_ROSTER'), true);
      assert.equal(canExportReportType(role, 'MEMBER_ROSTER'), true);
    }

    // Header role resolution defaults safely to STAFF when unspecified
    assert.equal(resolveReportUserRole({ headers: {} }), 'STAFF');
    assert.equal(
      resolveReportUserRole({ headers: { 'x-cbms-role': 'MPDC' } }),
      'MPDC',
    );
    assert.equal(
      resolveReportUserRole({
        headers: {},
        query: { role: 'MUNICIPAL_STATISTICIAN' },
      }),
      'MUNICIPAL_STATISTICIAN',
    );

    // Option A verification: STAFF can filter across all 8 dimensions at the household grain
    // (e.g., Poor AND Fisherfolk), and the HOUSEHOLD_ROSTER result contains ONLY household-level data
    const staffHhQuery = ReportFilterQuerySchema.parse({
      surveyYear: 2024,
      reportType: 'HOUSEHOLD_ROSTER',
      barangayGeoCode: '1608506001',
      criteria: ['poor', 'fisherfolk'],
      matchMode: 'all',
    });

    const staffHhReport = buildSampleReportData(staffHhQuery, true, 'STAFF');
    assert.ok((staffHhReport.householdRows?.length ?? 0) > 0);
    for (const hh of staffHhReport.householdRows ?? []) {
      assert.equal(hh.headName, 'Restricted (Member Data)');
      // All returned matchedIndicators for STAFF must strictly be HOUSEHOLD level
      for (const indId of hh.matchedIndicators) {
        assert.equal(
          REPORT_INDICATOR_MAP.get(indId)?.level,
          'HOUSEHOLD',
          `Expected STAFF HOUSEHOLD_ROSTER matchedIndicators to only include HOUSEHOLD-level indicators, found ${indId}`,
        );
      }
    }

    // Verify STAFF CSV & Excel export for HOUSEHOLD_ROSTER omits Member-level columns (Household Head Name, With OSY, etc.)
    const staffHhCsv = await generateCsvReportString(
      staffHhReport,
      staffHhQuery,
      'STAFF',
    );
    assert.equal(staffHhCsv.includes('CBMS Household UUID'), true);
    assert.equal(staffHhCsv.includes('Poor Status'), true);
    assert.equal(staffHhCsv.includes('4Ps Beneficiary'), true);
    assert.equal(staffHhCsv.includes('Longitude (WGS84)'), true);
    assert.equal(staffHhCsv.includes('Household Head Name'), false);
    assert.equal(staffHhCsv.includes('With OSY'), false);

    // By contrast, ADMIN CSV export for HOUSEHOLD_ROSTER includes Household Head Name
    const adminHhReport = buildSampleReportData(staffHhQuery, true, 'ADMIN');
    const adminHhCsv = await generateCsvReportString(
      adminHhReport,
      staffHhQuery,
      'ADMIN',
    );
    assert.equal(adminHhCsv.includes('Household Head Name'), true);
    assert.equal(
      sanitizeHouseholdRowForRole(adminHhReport.householdRows![0]!, 'ADMIN')
        .headName !== 'Restricted (Member Data)',
      true,
    );
  });

  it('computes aggregated Barangay Summary reports including Out-of-School Youth & 4Ps counts', () => {
    const query = ReportFilterQuerySchema.parse({
      surveyYear: 2024,
      reportType: 'BARANGAY_SUMMARY',
      barangayGeoCode: 'ALL',
      criteria: 'out_of_school_youth,beneficiary_4ps',
      matchMode: 'any',
    });

    assert.deepEqual(query.criteria, ['out_of_school_youth', 'beneficiary_4ps']);

    const report = buildSampleReportData(query, true);
    assert.equal(report.summary.reportType, 'BARANGAY_SUMMARY');
    assert.equal(report.barangayRows?.length, 12);
    assert.ok(report.summary.totalOutOfSchoolYouth > 0);
    assert.ok(report.summary.totalFourPsHouseholds > 0);

    const aurelio = report.barangayRows?.find(
      (b) => b.barangayGeoCode === '1608506001',
    );
    assert.ok(aurelio);
    assert.equal(aurelio.barangayName, 'Aurelio');
    assert.ok(aurelio.outOfSchoolYouthCount > 0);
    assert.ok((aurelio.attendingSchoolCount ?? 0) > 0);
    assert.ok((aurelio.nonLiterateCount ?? 0) > 0);
    assert.ok((aurelio.tvetCount ?? 0) > 0);
    assert.ok(aurelio.fisherfolkCount > 0);
    assert.ok(aurelio.farmerCount > 0);
    assert.ok(aurelio.unemployedCount > 0);
    assert.ok((aurelio.underemployedCount ?? 0) > 0);
    assert.ok((aurelio.ofwCount ?? 0) > 0);
    assert.ok(aurelio.fourPsHouseholds > 0);
  });

  it('filters Household & Member Rosters by Barangay, Match Mode (AND/OR), and Waiver Consent', () => {
    // AND intersection: Poor AND Fisherfolk in Barangay Aurelio (1608506001)
    const hhQueryAll = ReportFilterQuerySchema.parse({
      surveyYear: 2024,
      reportType: 'HOUSEHOLD_ROSTER',
      barangayGeoCode: '1608506001',
      criteria: ['poor', 'fisherfolk'],
      matchMode: 'all',
      waiverOnly: 'true',
    });

    const hhResult = buildSampleReportData(hhQueryAll, true);
    assert.ok((hhResult.householdRows?.length ?? 0) > 0);
    for (const row of hhResult.householdRows ?? []) {
      assert.equal(row.barangayGeoCode, '1608506001');
      assert.equal(row.poor, true);
      assert.equal(row.hasFisherfolk, true);
      assert.equal(row.waiverConsented, true);
    }

    // Member Roster filtered to Out-of-School Youth (OSY)
    const memQuery = ReportFilterQuerySchema.parse({
      surveyYear: 2024,
      reportType: 'MEMBER_ROSTER',
      barangayGeoCode: 'ALL',
      criteria: 'out_of_school_youth',
      matchMode: 'all',
    });

    const memResult = buildSampleReportData(memQuery, true);
    assert.ok((memResult.memberRows?.length ?? 0) > 0);
    for (const m of memResult.memberRows ?? []) {
      assert.equal(m.isOutOfSchoolYouth, true);
      assert.ok(m.age >= 6 && m.age <= 24);
    }

    // Member Roster filtered to Senior Citizens (senior_citizen) returns ONLY senior citizen individuals (age >= 60),
    // NOT non-senior household members living with a senior citizen
    assert.equal(
      getMemberIndicatorSqlPredicate('senior_citizen'),
      'COALESCE(mdc.a05_age, 0) >= 60',
    );
    assert.equal(
      getMemberIndicatorSqlPredicate('senior_citizen').includes('EXISTS'),
      false,
    );

    const seniorMemQuery = ReportFilterQuerySchema.parse({
      surveyYear: 2024,
      reportType: 'MEMBER_ROSTER',
      barangayGeoCode: 'ALL',
      criteria: 'senior_citizen',
      matchMode: 'all',
    });
    const seniorMemResult = buildSampleReportData(seniorMemQuery, true);
    assert.ok((seniorMemResult.memberRows?.length ?? 0) > 0);
    for (const m of seniorMemResult.memberRows ?? []) {
      assert.equal(m.isSeniorCitizen, true);
      assert.ok(
        m.age >= 60,
        `Expected every member in Senior Citizen MEMBER_ROSTER to have age >= 60, got ${m.age}`,
      );
    }
  });

  it('generates valid UTF-8 BOM CSV and Excel (.xlsx) Buffers with dynamic indicator columns', async () => {
    const query = ReportFilterQuerySchema.parse({
      surveyYear: 2024,
      reportType: 'BARANGAY_SUMMARY',
      barangayGeoCode: 'ALL',
      criteria: 'out_of_school_youth,beneficiary_4ps,fisherfolk',
      matchMode: 'any',
      format: 'csv',
    });

    const data = buildSampleReportData(query, true);
    const csvStr = await generateCsvReportString(data, query);

    // Must start with UTF-8 BOM (\uFEFF) and include Barangay and indicator headers
    assert.equal(csvStr.startsWith('\uFEFF'), true);
    assert.ok(csvStr.includes('Out-of-School Youth (OSY)'));
    assert.ok(csvStr.includes('4Ps Beneficiaries (HH)'));
    assert.ok(csvStr.includes('Aurelio'));
    assert.ok(csvStr.includes('Wilson'));

    const xlsxBuffer = await generateExcelReportBuffer(data, query, 'STAFF');
    assert.ok(Buffer.isBuffer(xlsxBuffer));
    // PK zip magic bytes for .xlsx (0x50, 0x4b)
    assert.equal(xlsxBuffer[0], 0x50);
    assert.equal(xlsxBuffer[1], 0x4b);
    assert.ok(xlsxBuffer.byteLength > 2000);
  });
});
