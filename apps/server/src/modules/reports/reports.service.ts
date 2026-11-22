import ExcelJS from 'exceljs';
import { writeToString } from '@fast-csv/format';
import {
  CBMS_REPORT_INDICATORS,
  REPORT_INDICATOR_MAP,
  canAccessMemberData,
  getRequiredTablesForIndicators,
  type BarangayAggregatedReportRow,
  type HouseholdReportRosterRow,
  type MemberReportRosterRow,
  type ReportFilterQuery,
  type ReportIndicatorId,
  type ReportPreviewResponse,
  type UserRole,
} from '@cbms/shared';
import { pool } from '../../db/kysely.js';

/**
 * Strips member-level data from a HouseholdReportRosterRow when the requesting role
 * is restricted from member-level data (e.g., STAFF under RA 10173):
 * - Masks `headName` (derived from `member_demographics_core` Section A)
 * - Keeps all 8 dimensions filterable at the household grain via EXISTS semijoins,
 *   while ensuring the returned row payload exposes strictly household-level data.
 */
export function sanitizeHouseholdRowForRole(
  row: HouseholdReportRosterRow,
  role: UserRole = 'ADMIN',
): HouseholdReportRosterRow {
  if (canAccessMemberData(role)) {
    return row;
  }
  const householdOnlyIndicators = row.matchedIndicators.filter(
    (id) => REPORT_INDICATOR_MAP.get(id)?.level === 'HOUSEHOLD',
  );
  return {
    ...row,
    headName: 'Restricted (Member Data)',
    matchedIndicators: householdOnlyIndicators,
  };
}

interface SanJoseBarangaySeed {
  barangayGeoCode: string;
  barangayName: string;
  totalHouseholds2024: number;
  totalPopulation2024: number;
  poorRate2024: number;
  nearPoor5Rate2024: number;
  electricityRate2024: number;
  internetRate2024: number;
  fourPsRate2024: number;
  coords: readonly [number, number];
}

const SAN_JOSE_BARANGAYS: readonly SanJoseBarangaySeed[] = [
  {
    barangayGeoCode: '1608506001',
    barangayName: 'Aurelio',
    totalHouseholds2024: 612,
    totalPopulation2024: 2685,
    poorRate2024: 28.4,
    nearPoor5Rate2024: 36.2,
    electricityRate2024: 94.1,
    internetRate2024: 52.8,
    fourPsRate2024: 24.5,
    coords: [125.57744, 10.00727],
  },
  {
    barangayGeoCode: '1608506002',
    barangayName: 'Cuarinta',
    totalHouseholds2024: 384,
    totalPopulation2024: 1710,
    poorRate2024: 46.8,
    nearPoor5Rate2024: 55.4,
    electricityRate2024: 82.6,
    internetRate2024: 27.3,
    fourPsRate2024: 41.9,
    coords: [125.61166, 10.0171],
  },
  {
    barangayGeoCode: '1608506003',
    barangayName: 'Don Ruben',
    totalHouseholds2024: 745,
    totalPopulation2024: 3210,
    poorRate2024: 24.6,
    nearPoor5Rate2024: 31.8,
    electricityRate2024: 95.8,
    internetRate2024: 58.4,
    fourPsRate2024: 21.2,
    coords: [125.58447, 10.01266],
  },
  {
    barangayGeoCode: '1608506004',
    barangayName: 'Jacquez',
    totalHouseholds2024: 428,
    totalPopulation2024: 1840,
    poorRate2024: 21.5,
    nearPoor5Rate2024: 28.9,
    electricityRate2024: 96.7,
    internetRate2024: 64.2,
    fourPsRate2024: 18.7,
    coords: [125.57396, 10.00572],
  },
  {
    barangayGeoCode: '1608506005',
    barangayName: 'Justiniana Edera',
    totalHouseholds2024: 590,
    totalPopulation2024: 2540,
    poorRate2024: 25.9,
    nearPoor5Rate2024: 33.4,
    electricityRate2024: 95.2,
    internetRate2024: 56.1,
    fourPsRate2024: 23.1,
    coords: [125.57789, 10.01218],
  },
  {
    barangayGeoCode: '1608506006',
    barangayName: 'Luna',
    totalHouseholds2024: 518,
    totalPopulation2024: 2295,
    poorRate2024: 38.6,
    nearPoor5Rate2024: 47.1,
    electricityRate2024: 88.9,
    internetRate2024: 36.8,
    fourPsRate2024: 34.0,
    coords: [125.59942, 9.99996],
  },
  {
    barangayGeoCode: '1608506007',
    barangayName: 'Mahayahay',
    totalHouseholds2024: 564,
    totalPopulation2024: 2475,
    poorRate2024: 32.8,
    nearPoor5Rate2024: 41.0,
    electricityRate2024: 91.4,
    internetRate2024: 45.6,
    fourPsRate2024: 28.9,
    coords: [125.58786, 10.00568],
  },
  {
    barangayGeoCode: '1608506008',
    barangayName: 'Matingbe',
    totalHouseholds2024: 492,
    totalPopulation2024: 2180,
    poorRate2024: 35.2,
    nearPoor5Rate2024: 43.8,
    electricityRate2024: 90.1,
    internetRate2024: 42.3,
    fourPsRate2024: 30.5,
    coords: [125.58421, 9.99822],
  },
  {
    barangayGeoCode: '1608506009',
    barangayName: 'Poblacion',
    totalHouseholds2024: 860,
    totalPopulation2024: 3640,
    poorRate2024: 13.8,
    nearPoor5Rate2024: 19.5,
    electricityRate2024: 98.6,
    internetRate2024: 76.4,
    fourPsRate2024: 13.2,
    coords: [125.57154, 10.00892],
  },
  {
    barangayGeoCode: '1608506010',
    barangayName: 'San Juan',
    totalHouseholds2024: 640,
    totalPopulation2024: 2730,
    poorRate2024: 17.9,
    nearPoor5Rate2024: 24.6,
    electricityRate2024: 97.4,
    internetRate2024: 69.5,
    fourPsRate2024: 16.4,
    coords: [125.57044, 10.01155],
  },
  {
    barangayGeoCode: '1608506011',
    barangayName: 'Sta Cruz',
    totalHouseholds2024: 790,
    totalPopulation2024: 3420,
    poorRate2024: 19.8,
    nearPoor5Rate2024: 27.2,
    electricityRate2024: 96.3,
    internetRate2024: 63.8,
    fourPsRate2024: 18.1,
    coords: [125.57586, 10.01756],
  },
  {
    barangayGeoCode: '1608506012',
    barangayName: 'Wilson',
    totalHouseholds2024: 445,
    totalPopulation2024: 1985,
    poorRate2024: 42.9,
    nearPoor5Rate2024: 51.6,
    electricityRate2024: 84.5,
    internetRate2024: 30.8,
    fourPsRate2024: 38.2,
    coords: [125.59331, 10.03089],
  },
];

/**
 * Returns a parameterized-safe SQL boolean predicate for a given ReportIndicatorId
 * when evaluated at the HOUSEHOLD grain (using EXISTS semijoins for member-level tables
 * per AGENTS.md §5: "ALWAYS use EXISTS semijoins for Member-Level (Sections A-E) filters on Household queries").
 */
export function getHouseholdIndicatorSqlPredicate(indicatorId: ReportIndicatorId): string {
  switch (indicatorId) {
    // 1. DEMOGRAPHICS & CIVIL REGISTRY
    case 'senior_citizen':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_demographics_core mdc ON mdc.member_id = hm.id WHERE hm.household_id = h.id AND mdc.a05_age >= 60)`;
    case 'children_under_5':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_demographics_core mdc ON mdc.member_id = hm.id WHERE hm.household_id = h.id AND mdc.a05_age < 5)`;
    case 'youth_school_age':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_demographics_core mdc ON mdc.member_id = hm.id WHERE hm.household_id = h.id AND mdc.a05_age BETWEEN 6 AND 24)`;
    case 'solo_parent':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_demographics_other mdo ON mdo.member_id = hm.id WHERE hm.household_id = h.id AND mdo.b05_solo_parent = 1)`;
    case 'pregnant_or_lactating':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_demographics_other mdo ON mdo.member_id = hm.id WHERE hm.household_id = h.id AND (mdo.b08_currently_pregnant = 1 OR mdo.b09_lactating_mother = 1))`;
    case 'unregistered_birth_lcr':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_demographics_core mdc ON mdc.member_id = hm.id WHERE hm.household_id = h.id AND mdc.a06_lcr_reg_status = 2)`;
    case 'no_philsys_id':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_demographics_other mdo ON mdo.member_id = hm.id WHERE hm.household_id = h.id AND mdo.b03_phil_id = 2)`;

    // 2. EDUCATION, LITERACY & TVET
    case 'out_of_school_youth':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_demographics_core mdc ON mdc.member_id = hm.id LEFT JOIN public.member_education med ON med.member_id = hm.id WHERE hm.household_id = h.id AND mdc.a05_age BETWEEN 6 AND 24 AND COALESCE(med.d01_currently_attending_school, 2) = 2)`;
    case 'attending_school':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_education med ON med.member_id = hm.id WHERE hm.household_id = h.id AND med.d01_currently_attending_school = 1)`;
    case 'non_literate':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_demographics_core mdc ON mdc.member_id = hm.id WHERE hm.household_id = h.id AND mdc.a05_age >= 10 AND mdc.a10_simple_literacy = 2)`;
    case 'tvet_graduate_or_attending':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_education med ON med.member_id = hm.id WHERE hm.household_id = h.id AND (med.d07_tvet_graduate = 1 OR med.d08_tvet_currently_attending = 1))`;

    // 3. HEALTH, NUTRITION & DISABILITY
    case 'pwd':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_demographics_other mdo ON mdo.member_id = hm.id WHERE hm.household_id = h.id AND mdo.b10_pwd = 1)`;
    case 'sick_without_treatment':
      return `(COALESCE(hh_health.f01_with_member_who_has_been_sick, 0) = 1 AND COALESCE(hh_health.f02_availed_medical_treatment, 2) = 2)`;
    case 'under5_mortality':
      return `COALESCE(hh_health.f06_with_child_died, 0) = 1`;

    // 4. EMPLOYMENT, LIVELIHOOD & MIGRATION
    case 'fisherfolk':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_economics mec ON mec.member_id = hm.id WHERE hm.household_id = h.id AND mec.e18_fisherfolk = 1)`;
    case 'farmer':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_economics mec ON mec.member_id = hm.id WHERE hm.household_id = h.id AND mec.e17_farmer = 1)`;
    case 'unemployed':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_economics mec ON mec.member_id = hm.id WHERE hm.household_id = h.id AND (mec.e01_employment_status = 2 OR mec.e13_try_look_for_work = 1))`;
    case 'underemployed':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_economics mec ON mec.member_id = hm.id WHERE hm.household_id = h.id AND (mec.e01_underemployment_status = 1 OR mec.e12_want_more_hours = 1))`;
    case 'ofw_member':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_migration mm ON mm.member_id = hm.id WHERE hm.household_id = h.id AND mm.c02_ofi IN (1, 2, 3))`;
    case 'calamity_displaced':
      return `EXISTS (SELECT 1 FROM public.household_members hm JOIN public.member_migration mm ON mm.member_id = hm.id WHERE hm.household_id = h.id AND mm.c06_internal_displacement = 2)`;

    // 5. POVERTY, INCOME, FOOD SECURITY & FINANCE
    case 'poor':
      return `COALESCE(hp.poor, 0) = 1`;
    case 'near_poor_5':
      return `COALESCE(hp.near_poor_5_pct, 0) = 1`;
    case 'near_poor_10':
      return `COALESCE(hp.near_poor_10_pct, 0) = 1`;
    case 'near_poor_15':
      return `COALESCE(hp.near_poor_15_pct, 0) = 1`;
    case 'near_poor_20':
      return `COALESCE(hp.near_poor_20_pct, 0) = 1`;
    case 'near_poor_25':
      return `COALESCE(hp.near_poor_25_pct, 0) = 1`;
    case 'food_insecure':
      return `(COALESCE(hfs.g04_skipped_meal, 0) = 1 OR COALESCE(hfs.g06_ran_out_of_food, 0) = 1 OR COALESCE(hfs.g07_hungry, 0) = 1 OR COALESCE(hfs.g08_not_eaten_whole_day, 0) = 1)`;
    case 'unbanked_household':
      return `(COALESCE(hfa.i01_a_bank_account, 2) != 1 AND COALESCE(hfa.i01_b_digital_bank_account, 2) != 1 AND COALESCE(hfa.i01_c_emoney_or_cash_card, 2) != 1 AND COALESCE(hfa.i01_e_account_with_coop, 2) != 1)`;

    // 6. SOCIAL PROTECTION & ASSISTANCE
    case 'beneficiary_4ps':
      return `COALESCE(hsp.m05_a_4ps, 0) = 1`;
    case 'no_4ps_poor':
      return `(COALESCE(hp.poor, 0) = 1 AND COALESCE(hsp.m05_a_4ps, 0) != 1)`;
    case 'socpen_beneficiary':
      return `COALESCE(hsp.m05_b_socpen, 0) = 1`;
    case 'aics_or_lgu_assistance':
      return `(COALESCE(hsp.m05_c_aics, 0) = 1 OR COALESCE(hsp.m05_g_lgu_assistance, 0) = 1)`;
    case 'no_philhealth':
      return `COALESCE(hsp.m01_c_philhealth, 2) != 1`;

    // 7. WASH, HOUSING, UTILITIES & ASSETS
    case 'unimproved_water':
      return `COALESCE(hw.n03_service_level_drinking_water, hw.n02_drinking_water, 1) > 1`;
    case 'unimproved_sanitation':
      return `COALESCE(hw.n08_service_level_toilet_facility, 1) > 2`;
    case 'makeshift_housing':
      return `(COALESCE(hho.o03_roof, 1) >= 3 OR COALESCE(hho.o04_outer_walls, 1) >= 3)`;
    case 'informal_settler':
      return `COALESCE(hho.o09_tenure, 1) IN (5, 6)`;
    case 'no_electricity':
      return `COALESCE(hho.o11_electricity, 2) != 1`;
    case 'banca_owner':
      return `(COALESCE(ha.o14_v_banca_motorized, 0) > 0 OR COALESCE(ha.o14_w_banca_nonmotorized, 0) > 0)`;

    // 8. CONNECTIVITY, TRANSPORT & CLIMATE SHOCKS
    case 'no_internet':
      return `COALESCE(hcs.k02_internet_at_home, 2) != 1`;
    case 'with_internet':
      return `COALESCE(hcs.k02_internet_at_home, 0) = 1`;
    case 'no_puv_access':
      return `COALESCE(hcs.h01_puv_access, 1) = 2`;
    case 'disaster_shock':
      return `(COALESCE(hds.j01_a_typhoon, 0) = 1 OR COALESCE(hds.j01_d_rain_or_flood, 0) = 1 OR COALESCE(hds.j01_e_erosion_landslide, 0) = 1)`;
    case 'unaware_evacuation_center':
      return `COALESCE(hds.j02_location_of_evacuation, 1) = 2`;
  }
}

/**
 * Returns a parameterized-safe SQL boolean predicate for a given ReportIndicatorId
 * when evaluated at the INDIVIDUAL MEMBER grain (`MEMBER_ROSTER`).
 * - MEMBER-level indicators (Sections A-E) filter the individual member row directly (`mdc`, `mdo`, `mm`, `med`, `mec`),
 *   so checking `senior_citizen` returns ONLY senior citizen members (never non-senior household members).
 * - HOUSEHOLD-level indicators (Sections F-O + Poverty) filter by the household the member belongs to.
 */
export function getMemberIndicatorSqlPredicate(indicatorId: ReportIndicatorId): string {
  switch (indicatorId) {
    // 1. DEMOGRAPHICS & CIVIL REGISTRY (Direct Member Predicates)
    case 'senior_citizen':
      return `COALESCE(mdc.a05_age, 0) >= 60`;
    case 'children_under_5':
      return `COALESCE(mdc.a05_age, 99) < 5`;
    case 'youth_school_age':
      return `COALESCE(mdc.a05_age, 0) BETWEEN 6 AND 24`;
    case 'solo_parent':
      return `COALESCE(mdo.b05_solo_parent, 0) = 1`;
    case 'pregnant_or_lactating':
      return `(COALESCE(mdo.b08_currently_pregnant, 0) = 1 OR COALESCE(mdo.b09_lactating_mother, 0) = 1)`;
    case 'unregistered_birth_lcr':
      return `COALESCE(mdc.a06_lcr_reg_status, 1) = 2`;
    case 'no_philsys_id':
      return `COALESCE(mdo.b03_phil_id, 1) = 2`;

    // 2. EDUCATION, LITERACY & TVET (Direct Member Predicates)
    case 'out_of_school_youth':
      return `(COALESCE(mdc.a05_age, 0) BETWEEN 6 AND 24 AND COALESCE(med.d01_currently_attending_school, 2) = 2)`;
    case 'attending_school':
      return `COALESCE(med.d01_currently_attending_school, 0) = 1`;
    case 'non_literate':
      return `(COALESCE(mdc.a05_age, 0) >= 10 AND COALESCE(mdc.a10_simple_literacy, 1) = 2)`;
    case 'tvet_graduate_or_attending':
      return `(COALESCE(med.d07_tvet_graduate, 0) = 1 OR COALESCE(med.d08_tvet_currently_attending, 0) = 1)`;

    // 3. HEALTH, NUTRITION & DISABILITY
    case 'pwd':
      return `COALESCE(mdo.b10_pwd, 0) = 1`;

    // 4. EMPLOYMENT, LIVELIHOOD & MIGRATION (Direct Member Predicates)
    case 'fisherfolk':
      return `COALESCE(mec.e18_fisherfolk, 0) = 1`;
    case 'farmer':
      return `COALESCE(mec.e17_farmer, 0) = 1`;
    case 'unemployed':
      return `(COALESCE(mec.e01_employment_status, 0) = 2 OR COALESCE(mec.e13_try_look_for_work, 0) = 1)`;
    case 'underemployed':
      return `(COALESCE(mec.e01_underemployment_status, 0) = 1 OR COALESCE(mec.e12_want_more_hours, 0) = 1)`;
    case 'ofw_member':
      return `COALESCE(mm.c02_ofi, 6) IN (1, 2, 3)`;
    case 'calamity_displaced':
      return `COALESCE(mm.c06_internal_displacement, 1) = 2`;

    // Household-level indicators (Sections F-O + Poverty) evaluate on the member's parent household
    default:
      return getHouseholdIndicatorSqlPredicate(indicatorId);
  }
}

/**
 * Evaluates whether a HouseholdReportRosterRow matches a specific ReportIndicatorId.
 */
export function evaluateHouseholdRowIndicator(
  row: HouseholdReportRosterRow,
  indicatorId: ReportIndicatorId,
): boolean {
  if (row.matchedIndicators.includes(indicatorId)) {
    return true;
  }
  switch (indicatorId) {
    case 'poor':
      return row.poor;
    case 'near_poor_5':
      return row.nearPoor5;
    case 'beneficiary_4ps':
      return row.fourPsBeneficiary;
    case 'no_4ps_poor':
      return row.poor && !row.fourPsBeneficiary;
    case 'no_electricity':
      return !row.electricity;
    case 'no_internet':
      return !row.internetAtHome;
    case 'with_internet':
      return row.internetAtHome;
    case 'senior_citizen':
      return row.hasSeniorCitizen;
    case 'pwd':
      return row.hasPwd;
    case 'solo_parent':
      return row.hasSoloParent;
    case 'out_of_school_youth':
      return row.hasOutOfSchoolYouth;
    case 'fisherfolk':
      return row.hasFisherfolk;
    case 'farmer':
      return row.hasFarmer;
    case 'food_insecure':
      return row.foodInsecure;
    case 'unimproved_water':
      return row.unimprovedWater;
    case 'makeshift_housing':
      return row.makeshiftHousing;
    case 'disaster_shock':
      return row.disasterShock;
    default:
      return false;
  }
}

/**
 * Generates deterministic, realistic San Jose dataset across all 12 Barangays and 8 CBMS Dimensions
 * when PostgreSQL `households` is at 0 rows (sample fallback mode) or for unit testing.
 */
export function buildSampleReportData(
  query: ReportFilterQuery,
  exportAll = false,
  role: UserRole = 'ADMIN',
): ReportPreviewResponse {
  const is2022 = query.surveyYear === 2022;
  const { householdTables, memberTables } = getRequiredTablesForIndicators(query.criteria);

  const SURNAMES = [
    'Dela Cruz',
    'Ecleo',
    'Reyes',
    'Santos',
    'Mendoza',
    'Villanueva',
    'Bautista',
    'Fernandez',
    'Ramos',
    'Navarro',
    'Castillo',
    'Aquino',
  ];
  const FIRST_M = ['Ricardo', 'Roberto', 'Eduardo', 'Marlon', 'Arnel', 'Danilo', 'Reynaldo', 'Jerome'];
  const FIRST_F = ['Maria', 'Elena', 'Rosario', 'Evelyn', 'Marites', 'Lorna', 'Grace', 'Teresita'];
  const PUROKS = ['Purok 1 (Centro)', 'Purok 2 (Seaside)', 'Purok 3 (Hilltop)', 'Purok 4 (Bagong Silang)'];

  const allHouseholds: HouseholdReportRosterRow[] = [];
  const allMembers: MemberReportRosterRow[] = [];

  for (let bIdx = 0; bIdx < SAN_JOSE_BARANGAYS.length; bIdx++) {
    const brgy = SAN_JOSE_BARANGAYS[bIdx]!;
    if (query.barangayGeoCode !== 'ALL' && query.barangayGeoCode !== brgy.barangayGeoCode) {
      continue;
    }

    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const globalIdx = bIdx * 4 + pIdx + 1;
      const poor = pIdx === 0 || (pIdx === 1 && brgy.poorRate2024 >= 32);
      const nearPoor5 = poor || pIdx === 2;
      const electricity = !(poor && pIdx === 0 && brgy.electricityRate2024 < 92);
      const internetAtHome = !poor && pIdx >= 2;
      const fourPsBeneficiary = poor && pIdx === 0; // pIdx === 1 when poor represents 4Ps Undercoverage Gap!
      const waiverConsented = globalIdx % 9 !== 0;
      const hhSize = 3 + ((globalIdx + pIdx) % 4);
      const males = Math.ceil(hhSize / 2);
      const females = hhSize - males;
      const lastName = SURNAMES[(bIdx + pIdx) % SURNAMES.length]!;
      const headFirstName = FIRST_M[(globalIdx) % FIRST_M.length]!;
      const husn = `${brgy.barangayGeoCode.slice(-3)}-00${pIdx + 1}`;
      const hsn = `${brgy.barangayGeoCode.slice(-3)}-00${pIdx + 1}-01`;
      const sitioPurok = PUROKS[pIdx % PUROKS.length]!;
      const houseNumber = `Blk ${pIdx + 1} Lot ${(globalIdx % 12) + 1}`;
      const lng = Number((brgy.coords[0] + (pIdx - 1.5) * 0.0008).toFixed(5));
      const lat = Number((brgy.coords[1] + (pIdx - 1.5) * 0.0006).toFixed(5));

      const hhIndicators = new Set<ReportIndicatorId>();
      if (poor) {
        hhIndicators.add('poor');
        hhIndicators.add('near_poor_5');
        hhIndicators.add('near_poor_10');
        hhIndicators.add('near_poor_15');
        hhIndicators.add('near_poor_20');
        hhIndicators.add('near_poor_25');
      } else if (nearPoor5) {
        hhIndicators.add('near_poor_5');
        hhIndicators.add('near_poor_10');
        hhIndicators.add('near_poor_15');
        hhIndicators.add('near_poor_20');
        hhIndicators.add('near_poor_25');
      }
      if (fourPsBeneficiary) hhIndicators.add('beneficiary_4ps');
      if (poor && !fourPsBeneficiary) hhIndicators.add('no_4ps_poor');
      if (!electricity) hhIndicators.add('no_electricity');
      if (!internetAtHome) hhIndicators.add('no_internet');
      if (internetAtHome) hhIndicators.add('with_internet');
      if (poor && pIdx === 0) {
        hhIndicators.add('food_insecure');
        hhIndicators.add('unimproved_water');
        hhIndicators.add('makeshift_housing');
        hhIndicators.add('unbanked_household');
      }
      if (bIdx % 2 === 0 && pIdx <= 1) {
        hhIndicators.add('disaster_shock');
      }
      if (pIdx === 1) {
        hhIndicators.add('aics_or_lgu_assistance');
      }
      if (pIdx === 0 && bIdx % 3 === 0) {
        hhIndicators.add('sick_without_treatment');
        hhIndicators.add('unimproved_sanitation');
      }
      if (pIdx === 1 && (bIdx === 0 || bIdx === 1 || bIdx === 5 || bIdx === 7 || bIdx === 11)) {
        hhIndicators.add('banca_owner');
      }
      if (pIdx === 3 && poor) {
        hhIndicators.add('informal_settler');
        hhIndicators.add('no_philhealth');
      }
      if (bIdx === 1 || bIdx === 5 || bIdx === 11) {
        if (pIdx === 0) hhIndicators.add('no_puv_access');
        if (pIdx === 2) hhIndicators.add('unaware_evacuation_center');
      }

      const hhOnlyIndicators = new Set<ReportIndicatorId>(hhIndicators);

      let hasSeniorCitizen = false;
      let hasPwd = false;
      let hasSoloParent = false;
      let hasOutOfSchoolYouth = false;
      let hasFisherfolk = false;
      let hasFarmer = false;

      const hhId = `hh-${brgy.barangayGeoCode}-${pIdx + 1}`;
      const cbmsUuid = `cb00${query.surveyYear}-${brgy.barangayGeoCode.slice(-3)}0-4000-8000-${String(globalIdx).padStart(12, '0')}`;

      for (let mIdx = 0; mIdx < hhSize; mIdx++) {
        const isMale = mIdx === 0 ? true : mIdx === 1 ? false : mIdx % 2 === 0;
        const age =
          mIdx === 0
            ? 38 + ((bIdx * 3 + pIdx * 7) % 30)
            : mIdx === 1
              ? 34 + ((bIdx * 3 + pIdx * 5) % 26)
              : mIdx === 2
                ? 14 + ((bIdx + pIdx * 2) % 8)
                : 3 + ((mIdx * 3 + bIdx) % 12);

        const isSenior = age >= 60;
        const isUnder5 = age < 5;
        const isYouth = age >= 6 && age <= 24;
        const isPwd = (mIdx === 0 && globalIdx % 5 === 0) || (mIdx === 2 && globalIdx % 11 === 0);
        const isSoloParent = mIdx === 0 && pIdx === 1 && hhSize <= 4;
        const isOsy = isYouth && poor && mIdx === 2;
        const attendingSchool = isYouth && !isOsy;
        const isFisherfolk = mIdx === 0 && poor && (bIdx % 2 === 0);
        const isFarmer = mIdx === 0 && (bIdx % 2 === 1) && pIdx <= 1;
        const isUnemployed = mIdx === 1 && poor && pIdx === 0;

        // Start member indicators ONLY with the household-grain indicators (never leaking another member's flags)
        const memIndicators = new Set<ReportIndicatorId>(hhOnlyIndicators);

        if (isSenior) {
          hasSeniorCitizen = true;
          hhIndicators.add('senior_citizen');
          memIndicators.add('senior_citizen');
          if (poor) {
            hhIndicators.add('socpen_beneficiary');
            memIndicators.add('socpen_beneficiary');
          }
        }
        if (isUnder5) {
          hhIndicators.add('children_under_5');
          memIndicators.add('children_under_5');
        }
        if (isYouth) {
          hhIndicators.add('youth_school_age');
          memIndicators.add('youth_school_age');
        }
        if (isPwd) {
          hasPwd = true;
          hhIndicators.add('pwd');
          memIndicators.add('pwd');
        }
        if (isSoloParent) {
          hasSoloParent = true;
          hhIndicators.add('solo_parent');
          memIndicators.add('solo_parent');
        }
        if (isOsy) {
          hasOutOfSchoolYouth = true;
          hhIndicators.add('out_of_school_youth');
          memIndicators.add('out_of_school_youth');
        }
        if (attendingSchool) {
          hhIndicators.add('attending_school');
          memIndicators.add('attending_school');
        }
        if (isFisherfolk) {
          hasFisherfolk = true;
          hhIndicators.add('fisherfolk');
          memIndicators.add('fisherfolk');
        }
        if (isFarmer) {
          hasFarmer = true;
          hhIndicators.add('farmer');
          memIndicators.add('farmer');
        }
        if (isUnemployed) {
          hhIndicators.add('unemployed');
          memIndicators.add('unemployed');
        }

        if (!isMale && mIdx === 1 && age <= 42 && pIdx === 0) {
          memIndicators.add('pregnant_or_lactating');
          hhIndicators.add('pregnant_or_lactating');
        }
        if (isUnder5 && poor) {
          memIndicators.add('unregistered_birth_lcr');
          hhIndicators.add('unregistered_birth_lcr');
        }
        if (poor && mIdx >= 2) {
          memIndicators.add('no_philsys_id');
          hhIndicators.add('no_philsys_id');
        }
        if (mIdx === 0 && !poor && pIdx === 2) {
          memIndicators.add('tvet_graduate_or_attending');
          hhIndicators.add('tvet_graduate_or_attending');
        }
        if (mIdx === 1 && !poor && pIdx === 3) {
          memIndicators.add('ofw_member');
          hhIndicators.add('ofw_member');
        }
        if (isSenior && poor && bIdx % 3 === 0) {
          memIndicators.add('non_literate');
          hhIndicators.add('non_literate');
        }
        if (isFisherfolk && poor) {
          memIndicators.add('underemployed');
          hhIndicators.add('underemployed');
        }
        if (hhIndicators.has('disaster_shock') && poor) {
          memIndicators.add('calamity_displaced');
          hhIndicators.add('calamity_displaced');
        }

        const firstName =
          mIdx === 0
            ? headFirstName
            : isMale
              ? FIRST_M[(globalIdx + mIdx) % FIRST_M.length]!
              : FIRST_F[(globalIdx + mIdx) % FIRST_F.length]!;

        const occupation = isFisherfolk
          ? 'Fisherfolk'
          : isFarmer
            ? 'Farmer'
            : isOsy
              ? 'Out-of-School Youth'
              : attendingSchool
                ? 'Student'
                : isUnemployed
                  ? 'Unemployed'
                  : mIdx === 0
                    ? 'Retail / Municipal Employee'
                    : 'Homemaker / Dependent';

        allMembers.push({
          memberId: `${hhId}-m${mIdx + 1}`,
          householdId: hhId,
          cbmsUuid,
          barangayGeoCode: brgy.barangayGeoCode,
          barangayName: brgy.barangayName,
          sitioPurok,
          husn,
          hsn,
          lineNumber: String(mIdx + 1).padStart(2, '0'),
          lastName,
          firstName,
          middleName: SURNAMES[(bIdx + mIdx + 3) % SURNAMES.length]!,
          suffix: '',
          sex: isMale ? 'Male' : 'Female',
          age,
          relationToHead: mIdx === 0 ? 'Head' : mIdx === 1 ? 'Spouse' : 'Child',
          isSeniorCitizen: isSenior,
          isPwd,
          isSoloParent,
          isOutOfSchoolYouth: isOsy,
          attendingSchool,
          isFisherfolk,
          isFarmer,
          isUnemployed,
          occupation,
          householdPoor: poor,
          fourPsBeneficiary,
          waiverConsented,
          longitude: lng,
          latitude: lat,
          matchedIndicators: Array.from(memIndicators),
        });
      }

      allHouseholds.push({
        id: hhId,
        cbmsUuid,
        husn,
        hsn,
        barangayGeoCode: brgy.barangayGeoCode,
        barangayName: brgy.barangayName,
        sitioPurok,
        houseNumber,
        headName: `${headFirstName} ${lastName}`,
        hhSize,
        males,
        females,
        longitude: lng,
        latitude: lat,
        waiverConsented,
        poor,
        nearPoor5,
        fourPsBeneficiary,
        electricity,
        internetAtHome,
        hasSeniorCitizen,
        hasPwd,
        hasSoloParent,
        hasOutOfSchoolYouth,
        hasFisherfolk,
        hasFarmer,
        foodInsecure: hhIndicators.has('food_insecure'),
        unimprovedWater: hhIndicators.has('unimproved_water'),
        makeshiftHousing: hhIndicators.has('makeshift_housing'),
        disasterShock: hhIndicators.has('disaster_shock'),
        matchedIndicators: Array.from(hhIndicators),
      });
    }
  }

  const searchClean = (query.search ?? '').trim().toLowerCase();

  const matchesCriteria = (rowIndicators: readonly ReportIndicatorId[]): boolean => {
    if (query.criteria.length === 0) return true;
    const set = new Set(rowIndicators);
    if (query.matchMode === 'all') {
      return query.criteria.every((c) => set.has(c));
    }
    return query.criteria.some((c) => set.has(c));
  };

  const filteredHouseholds = allHouseholds.filter((hh) => {
    if (query.waiverOnly && !hh.waiverConsented) return false;
    if (!matchesCriteria(hh.matchedIndicators)) return false;
    if (searchClean) {
      const hay = `${hh.headName} ${hh.barangayName} ${hh.sitioPurok} ${hh.husn} ${hh.hsn}`.toLowerCase();
      if (!hay.includes(searchClean)) return false;
    }
    return true;
  });

  const filteredMembers = allMembers.filter((mem) => {
    if (query.waiverOnly && !mem.waiverConsented) return false;
    if (!matchesCriteria(mem.matchedIndicators)) return false;
    if (searchClean) {
      const hay = `${mem.firstName} ${mem.lastName} ${mem.barangayName} ${mem.sitioPurok} ${mem.occupation} ${mem.husn}`.toLowerCase();
      if (!hay.includes(searchClean)) return false;
    }
    return true;
  });

  // Build Barangay Aggregated Summary Rows (Scaled to Municipal CBMS Totals)
  const barangayRows: BarangayAggregatedReportRow[] = SAN_JOSE_BARANGAYS.filter(
    (b) => query.barangayGeoCode === 'ALL' || b.barangayGeoCode === query.barangayGeoCode,
  )
    .map((b) => {
      const totalHouseholds = is2022
        ? Math.round(b.totalHouseholds2024 * 0.94)
        : b.totalHouseholds2024;
      const totalPopulation = is2022
        ? Math.round(b.totalPopulation2024 * 0.95)
        : b.totalPopulation2024;
      const totalMales = Math.round(totalPopulation * 0.512);
      const totalFemales = totalPopulation - totalMales;
      const poorRate = Number(
        (is2022 ? Math.min(62, b.poorRate2024 + 4.3) : b.poorRate2024).toFixed(1),
      );
      const nearPoor5Rate = Number(
        (is2022 ? Math.min(70, b.nearPoor5Rate2024 + 4.5) : b.nearPoor5Rate2024).toFixed(1),
      );
      const fourPsRate = Number(
        (is2022 ? b.fourPsRate2024 + 1.8 : b.fourPsRate2024).toFixed(1),
      );
      const electricityRate = Number(
        (is2022 ? Math.max(72, b.electricityRate2024 - 3.6) : b.electricityRate2024).toFixed(1),
      );
      const internetRate = Number(
        (is2022 ? Math.max(18, b.internetRate2024 - 9.4) : b.internetRate2024).toFixed(1),
      );

      const poorHouseholds = Math.round((poorRate / 100) * totalHouseholds);
      const nearPoor5Households = Math.round((nearPoor5Rate / 100) * totalHouseholds);
      const fourPsHouseholds = Math.round((fourPsRate / 100) * totalHouseholds);
      const no4psPoorHouseholds = Math.max(0, poorHouseholds - fourPsHouseholds);
      const noElectricityHouseholds = Math.max(
        0,
        totalHouseholds - Math.round((electricityRate / 100) * totalHouseholds),
      );
      const noInternetHouseholds = Math.max(
        0,
        totalHouseholds - Math.round((internetRate / 100) * totalHouseholds),
      );

      // Realistic sectoral counts derived from Barangay demographics & poverty profile
      const outOfSchoolYouthCount = Math.round(totalPopulation * (0.022 + (poorRate / 100) * 0.038));
      const householdsWithOsy = Math.round(outOfSchoolYouthCount * 0.84);
      const seniorCitizensCount = Math.round(totalPopulation * 0.088);
      const householdsWithSenior = Math.round(seniorCitizensCount * 0.78);
      const pwdCount = Math.round(totalPopulation * 0.024);
      const householdsWithPwd = Math.round(pwdCount * 0.91);
      const soloParentCount = Math.round(totalHouseholds * 0.064);
      const fisherfolkCount = Math.round(totalHouseholds * (0.14 + (poorRate / 100) * 0.18));
      const farmerCount = Math.round(totalHouseholds * (0.11 + (poorRate / 100) * 0.12));
      const unemployedCount = Math.round(totalPopulation * 0.036);
      const foodInsecureHouseholds = Math.round(poorHouseholds * 0.54);
      const unimprovedWaterHouseholds = Math.round(poorHouseholds * 0.38);
      const unimprovedSanitationHouseholds = Math.round(poorHouseholds * 0.21);
      const makeshiftHousingHouseholds = Math.round(poorHouseholds * 0.34);
      const disasterShockHouseholds = Math.round(totalHouseholds * 0.29);

      const indicatorCounts: Record<string, number> = {
        poor: poorHouseholds,
        near_poor_5: nearPoor5Households,
        near_poor_10: Math.round(nearPoor5Households * 1.12),
        near_poor_15: Math.round(nearPoor5Households * 1.22),
        near_poor_20: Math.round(nearPoor5Households * 1.31),
        near_poor_25: Math.round(nearPoor5Households * 1.39),
        beneficiary_4ps: fourPsHouseholds,
        no_4ps_poor: no4psPoorHouseholds,
        socpen_beneficiary: Math.round(seniorCitizensCount * 0.58),
        aics_or_lgu_assistance: Math.round(poorHouseholds * 0.42),
        no_philhealth: Math.round(poorHouseholds * 0.19),
        out_of_school_youth: outOfSchoolYouthCount,
        attending_school: Math.round(totalPopulation * 0.29),
        non_literate: Math.round(totalPopulation * 0.015),
        tvet_graduate_or_attending: Math.round(totalPopulation * 0.048),
        senior_citizen: seniorCitizensCount,
        children_under_5: Math.round(totalPopulation * 0.092),
        youth_school_age: Math.round(totalPopulation * 0.33),
        solo_parent: soloParentCount,
        pregnant_or_lactating: Math.round(totalHouseholds * 0.052),
        unregistered_birth_lcr: Math.round(totalPopulation * 0.012),
        no_philsys_id: Math.round(totalPopulation * 0.068),
        pwd: pwdCount,
        sick_without_treatment: Math.round(poorHouseholds * 0.24),
        under5_mortality: Math.max(0, Math.round(poorHouseholds * 0.012)),
        fisherfolk: fisherfolkCount,
        farmer: farmerCount,
        unemployed: unemployedCount,
        underemployed: Math.round(totalPopulation * 0.074),
        ofw_member: Math.round(totalHouseholds * 0.055),
        calamity_displaced: Math.round(disasterShockHouseholds * 0.22),
        food_insecure: foodInsecureHouseholds,
        unbanked_household: Math.round(poorHouseholds * 0.68),
        unimproved_water: unimprovedWaterHouseholds,
        unimproved_sanitation: unimprovedSanitationHouseholds,
        makeshift_housing: makeshiftHousingHouseholds,
        informal_settler: Math.round(poorHouseholds * 0.14),
        no_electricity: noElectricityHouseholds,
        banca_owner: Math.round(fisherfolkCount * 0.62),
        no_internet: noInternetHouseholds,
        with_internet: totalHouseholds - noInternetHouseholds,
        no_puv_access: Math.round(totalHouseholds * 0.16),
        disaster_shock: disasterShockHouseholds,
        unaware_evacuation_center: Math.round(totalHouseholds * 0.08),
      };

      let matchingHouseholds = totalHouseholds;
      if (query.criteria.length > 0) {
        const counts = query.criteria.map((c) =>
          Math.min(totalHouseholds, indicatorCounts[c] ?? 0),
        );
        if (query.matchMode === 'all') {
          const minCount = Math.min(...counts);
          matchingHouseholds =
            query.criteria.length === 1
              ? minCount
              : Math.max(1, Math.round(minCount * Math.pow(0.72, query.criteria.length - 1)));
        } else {
          const sumCounts = counts.reduce((a, v) => a + v, 0);
          matchingHouseholds = Math.min(totalHouseholds, Math.round(sumCounts * 0.85));
        }
      }
      if (query.waiverOnly) {
        matchingHouseholds = Math.round(matchingHouseholds * 0.94);
      }

      const matchingRate =
        totalHouseholds > 0
          ? Number(((matchingHouseholds / totalHouseholds) * 100).toFixed(1))
          : 0;

      return {
        barangayGeoCode: b.barangayGeoCode,
        barangayName: b.barangayName,
        totalHouseholds,
        totalPopulation,
        totalMales,
        totalFemales,
        matchingHouseholds,
        matchingRate,
        poorHouseholds,
        poorRate,
        nearPoor5Households,
        fourPsHouseholds,
        fourPsRate,
        no4psPoorHouseholds,
        outOfSchoolYouthCount,
        householdsWithOsy,
        attendingSchoolCount: indicatorCounts.attending_school ?? 0,
        nonLiterateCount: indicatorCounts.non_literate ?? 0,
        tvetCount: indicatorCounts.tvet_graduate_or_attending ?? 0,
        seniorCitizensCount,
        householdsWithSenior,
        pwdCount,
        householdsWithPwd,
        soloParentCount,
        fisherfolkCount,
        farmerCount,
        unemployedCount,
        underemployedCount: indicatorCounts.underemployed ?? 0,
        ofwCount: indicatorCounts.ofw_member ?? 0,
        foodInsecureHouseholds,
        unimprovedWaterHouseholds,
        unimprovedSanitationHouseholds,
        makeshiftHousingHouseholds,
        noElectricityHouseholds,
        noInternetHouseholds,
        disasterShockHouseholds,
        indicatorCounts,
      };
    })
    .filter((r) => {
      if (!searchClean) return true;
      return (
        r.barangayName.toLowerCase().includes(searchClean) ||
        r.barangayGeoCode.toLowerCase().includes(searchClean)
      );
    });

  const limit = exportAll ? 50000 : (query.limit ?? 50);
  const offset = exportAll ? 0 : (query.offset ?? 0);

  const totalMatchingRows =
    query.reportType === 'BARANGAY_SUMMARY'
      ? barangayRows.length
      : query.reportType === 'HOUSEHOLD_ROSTER'
        ? filteredHouseholds.length
        : filteredMembers.length;

  return {
    summary: {
      surveyYear: query.surveyYear,
      reportType: query.reportType,
      barangayGeoCode: query.barangayGeoCode,
      criteria: query.criteria,
      matchMode: query.matchMode,
      waiverOnly: Boolean(query.waiverOnly),
      usingSampleFallback: true,
      totalMatchingRows,
      totalHouseholdsCovered:
        query.reportType === 'BARANGAY_SUMMARY'
          ? barangayRows.reduce((s, r) => s + r.matchingHouseholds, 0)
          : filteredHouseholds.length,
      totalPopulationCovered:
        query.reportType === 'BARANGAY_SUMMARY'
          ? barangayRows.reduce((s, r) => s + r.totalPopulation, 0)
          : filteredHouseholds.reduce((s, r) => s + r.hhSize, 0),
      totalPoorHouseholds:
        query.reportType === 'BARANGAY_SUMMARY'
          ? barangayRows.reduce((s, r) => s + r.poorHouseholds, 0)
          : filteredHouseholds.filter((h) => h.poor).length,
      totalFourPsHouseholds:
        query.reportType === 'BARANGAY_SUMMARY'
          ? barangayRows.reduce((s, r) => s + r.fourPsHouseholds, 0)
          : filteredHouseholds.filter((h) => h.fourPsBeneficiary).length,
      totalOutOfSchoolYouth:
        query.reportType === 'BARANGAY_SUMMARY'
          ? barangayRows.reduce((s, r) => s + r.outOfSchoolYouthCount, 0)
          : filteredMembers.filter((m) => m.isOutOfSchoolYouth).length,
      totalSeniorCitizens:
        query.reportType === 'BARANGAY_SUMMARY'
          ? barangayRows.reduce((s, r) => s + r.seniorCitizensCount, 0)
          : filteredMembers.filter((m) => m.isSeniorCitizen).length,
      totalPwdMembers:
        query.reportType === 'BARANGAY_SUMMARY'
          ? barangayRows.reduce((s, r) => s + r.pwdCount, 0)
          : filteredMembers.filter((m) => m.isPwd).length,
      prunedHouseholdTablesJoined: Array.from(householdTables),
      prunedMemberTablesJoined: Array.from(memberTables),
    },
    barangayRows:
      query.reportType === 'BARANGAY_SUMMARY'
        ? barangayRows.slice(offset, offset + limit)
        : undefined,
    householdRows:
      query.reportType === 'HOUSEHOLD_ROSTER'
        ? filteredHouseholds
            .slice(offset, offset + limit)
            .map((h) => sanitizeHouseholdRowForRole(h, role))
        : undefined,
    memberRows:
      query.reportType === 'MEMBER_ROSTER'
        ? filteredMembers.slice(offset, offset + limit)
        : undefined,
  };
}

/**
 * Executes the live PostGIS / PostgreSQL CBMS Report query directly against the database.
 * When a survey year has 0 uploaded households (e.g., 2022 prior to upload), returns 0 counts/rows
 * directly from PostgreSQL without synthetic sample numbers.
 */
export async function executeReportQuery(
  query: ReportFilterQuery,
  exportAll = false,
  role: UserRole = 'ADMIN',
): Promise<ReportPreviewResponse> {
  const { householdTables, memberTables } = getRequiredTablesForIndicators(query.criteria);
  const includeMemberData = canAccessMemberData(role);

  // Build dynamic WHERE predicates from active criteria:
  // - BARANGAY_SUMMARY & HOUSEHOLD_ROSTER use EXISTS semijoins for member-level criteria
  // - MEMBER_ROSTER evaluates member-level criteria directly on the individual member row
  const joinOp = query.matchMode === 'any' ? ' OR ' : ' AND ';
  const hhCriteriaPredicates = query.criteria.map((c) => getHouseholdIndicatorSqlPredicate(c));
  const criteriaWhereClause =
    hhCriteriaPredicates.length > 0 ? `(${hhCriteriaPredicates.join(joinOp)})` : 'TRUE';

  const memCriteriaPredicates = query.criteria.map((c) => getMemberIndicatorSqlPredicate(c));
  const memberCriteriaWhereClause =
    memCriteriaPredicates.length > 0 ? `(${memCriteriaPredicates.join(joinOp)})` : 'TRUE';

  const params: unknown[] = [query.surveyYear];
  let brgyClause = '';
  if (query.barangayGeoCode && query.barangayGeoCode !== 'ALL') {
    params.push(query.barangayGeoCode);
    brgyClause = `AND b.barangay_geo_code = $${params.length}`;
  }

  const waiverClause = query.waiverOnly
    ? `AND COALESCE(h.agree_to_sign_the_waiver, 1) = 1`
    : '';

  let brgySearchClause = '';
  let hhSearchClause = '';
  let memSearchClause = '';
  if (query.search && query.search.trim().length > 0) {
    params.push(`%${query.search.trim()}%`);
    const pIdx = params.length;
    brgySearchClause = `AND (
      COALESCE(b.name, '') ILIKE $${pIdx}
      OR COALESCE(b.barangay_geo_code, '') ILIKE $${pIdx}
    )`;
    hhSearchClause = includeMemberData
      ? `AND (
      COALESCE(b.name, '') ILIKE $${pIdx}
      OR COALESCE(h.address_sitio_purok, '') ILIKE $${pIdx}
      OR COALESCE(h.husn, '') ILIKE $${pIdx}
      OR COALESCE(h.hsn, '') ILIKE $${pIdx}
      OR COALESCE(head_mem.head_name, '') ILIKE $${pIdx}
    )`
      : `AND (
      COALESCE(b.name, '') ILIKE $${pIdx}
      OR COALESCE(h.address_sitio_purok, '') ILIKE $${pIdx}
      OR COALESCE(h.husn, '') ILIKE $${pIdx}
      OR COALESCE(h.hsn, '') ILIKE $${pIdx}
    )`;
    memSearchClause = `AND (
      COALESCE(b.name, '') ILIKE $${pIdx}
      OR COALESCE(h.address_sitio_purok, '') ILIKE $${pIdx}
      OR COALESCE(h.husn, '') ILIKE $${pIdx}
      OR COALESCE(h.hsn, '') ILIKE $${pIdx}
      OR COALESCE(mdc.a01_last_name, '') ILIKE $${pIdx}
      OR COALESCE(mdc.a01_first_name, '') ILIKE $${pIdx}
    )`;
  }

  if (query.reportType === 'BARANGAY_SUMMARY') {
    const dynamicCriteriaSelects = query.criteria
      .map(
        (c) =>
          `, COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate(c)} ${waiverClause})::int AS "crit_${c}"`,
      )
      .join('\n          ');

    const sqlText = `
        SELECT
          b.barangay_geo_code,
          b.name AS barangay_name,
          COUNT(DISTINCT h.id)::int AS total_households,
          COALESCE(SUM(h.hh_size), 0)::int AS total_population,
          COALESCE(SUM(h.number_of_males), 0)::int AS total_males,
          COALESCE(SUM(h.number_of_females), 0)::int AS total_females,
          COUNT(DISTINCT h.id) FILTER (WHERE ${criteriaWhereClause} ${waiverClause})::int AS matching_households,
          COUNT(DISTINCT h.id) FILTER (WHERE COALESCE(hp.poor, 0) = 1)::int AS poor_households,
          COUNT(DISTINCT h.id) FILTER (WHERE COALESCE(hp.near_poor_5_pct, 0) = 1)::int AS near_poor_5_households,
          COUNT(DISTINCT h.id) FILTER (WHERE COALESCE(hsp.m05_a_4ps, 0) = 1)::int AS four_ps_households,
          COUNT(DISTINCT h.id) FILTER (WHERE COALESCE(hp.poor, 0) = 1 AND COALESCE(hsp.m05_a_4ps, 0) != 1)::int AS no_4ps_poor_households,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('out_of_school_youth')})::int AS households_with_osy,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('attending_school')})::int AS attending_school_count,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('non_literate')})::int AS non_literate_count,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('tvet_graduate_or_attending')})::int AS tvet_count,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('senior_citizen')})::int AS households_with_senior,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('pwd')})::int AS households_with_pwd,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('solo_parent')})::int AS solo_parent_count,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('fisherfolk')})::int AS fisherfolk_count,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('farmer')})::int AS farmer_count,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('unemployed')})::int AS unemployed_count,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('underemployed')})::int AS underemployed_count,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('ofw_member')})::int AS ofw_count,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('food_insecure')})::int AS food_insecure_households,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('unimproved_water')})::int AS unimproved_water_households,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('unimproved_sanitation')})::int AS unimproved_sanitation_households,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('makeshift_housing')})::int AS makeshift_housing_households,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('no_electricity')})::int AS no_electricity_households,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('no_internet')})::int AS no_internet_households,
          COUNT(DISTINCT h.id) FILTER (WHERE ${getHouseholdIndicatorSqlPredicate('disaster_shock')})::int AS disaster_shock_households
          ${dynamicCriteriaSelects}
        FROM public.barangays b
        LEFT JOIN public.survey_years sy ON sy.survey_year = $1
        LEFT JOIN public.households h ON h.survey_year_id = sy.id AND h.barangay_geo_code = b.barangay_geo_code
        LEFT JOIN public.household_poverty hp ON hp.household_id = h.id
        LEFT JOIN public.household_social_protection hsp ON hsp.household_id = h.id
        LEFT JOIN public.household_food_security hfs ON hfs.household_id = h.id
        LEFT JOIN public.household_financial_accounts hfa ON hfa.household_id = h.id
        LEFT JOIN public.household_health hh_health ON hh_health.household_id = h.id
        LEFT JOIN public.household_wash hw ON hw.household_id = h.id
        LEFT JOIN public.household_housing hho ON hho.household_id = h.id
        LEFT JOIN public.household_assets ha ON ha.household_id = h.id
        LEFT JOIN public.household_connectivity_safety hcs ON hcs.household_id = h.id
        LEFT JOIN public.household_disaster_shocks hds ON hds.household_id = h.id
        WHERE 1=1 ${brgyClause} ${brgySearchClause}
        GROUP BY b.barangay_geo_code, b.name
        ORDER BY b.barangay_geo_code ASC;
      `;

    const brgyRes = await pool.query(sqlText, params);
    const barangayRows: BarangayAggregatedReportRow[] = brgyRes.rows.map((r) => {
      const totalHh = Number(r.total_households ?? 0);
      const poorHh = Number(r.poor_households ?? 0);
      const fourPsHh = Number(r.four_ps_households ?? 0);
      const matchingHh = Number(r.matching_households ?? 0);
      const hhOsy = Number(r.households_with_osy ?? 0);
      const hhSenior = Number(r.households_with_senior ?? 0);
      const hhPwd = Number(r.households_with_pwd ?? 0);

      const toRate = (n: number) => (totalHh > 0 ? Number(((n / totalHh) * 100).toFixed(1)) : 0);

      const indicatorCounts: Record<string, number> = {
        poor: poorHh,
        near_poor_5: Number(r.near_poor_5_households ?? 0),
        beneficiary_4ps: fourPsHh,
        no_4ps_poor: Number(r.no_4ps_poor_households ?? 0),
        out_of_school_youth: hhOsy,
        attending_school: Number(r.attending_school_count ?? 0),
        non_literate: Number(r.non_literate_count ?? 0),
        tvet_graduate_or_attending: Number(r.tvet_count ?? 0),
        senior_citizen: hhSenior,
        pwd: hhPwd,
        solo_parent: Number(r.solo_parent_count ?? 0),
        fisherfolk: Number(r.fisherfolk_count ?? 0),
        farmer: Number(r.farmer_count ?? 0),
        unemployed: Number(r.unemployed_count ?? 0),
        underemployed: Number(r.underemployed_count ?? 0),
        ofw_member: Number(r.ofw_count ?? 0),
        food_insecure: Number(r.food_insecure_households ?? 0),
        unimproved_water: Number(r.unimproved_water_households ?? 0),
        unimproved_sanitation: Number(r.unimproved_sanitation_households ?? 0),
        makeshift_housing: Number(r.makeshift_housing_households ?? 0),
        no_electricity: Number(r.no_electricity_households ?? 0),
        no_internet: Number(r.no_internet_households ?? 0),
        disaster_shock: Number(r.disaster_shock_households ?? 0),
      };

      for (const c of query.criteria) {
        indicatorCounts[c] = Number(r[`crit_${c}`] ?? indicatorCounts[c] ?? 0);
      }

      return {
        barangayGeoCode: String(r.barangay_geo_code),
        barangayName: String(r.barangay_name),
        totalHouseholds: totalHh,
        totalPopulation: Number(r.total_population ?? 0),
        totalMales: Number(r.total_males ?? 0),
        totalFemales: Number(r.total_females ?? 0),
        matchingHouseholds: matchingHh,
        matchingRate: toRate(matchingHh),
        poorHouseholds: poorHh,
        poorRate: toRate(poorHh),
        nearPoor5Households: Number(r.near_poor_5_households ?? 0),
        fourPsHouseholds: fourPsHh,
        fourPsRate: toRate(fourPsHh),
        no4psPoorHouseholds: Number(r.no_4ps_poor_households ?? 0),
        outOfSchoolYouthCount: hhOsy,
        householdsWithOsy: hhOsy,
        attendingSchoolCount: Number(r.attending_school_count ?? 0),
        nonLiterateCount: Number(r.non_literate_count ?? 0),
        tvetCount: Number(r.tvet_count ?? 0),
        seniorCitizensCount: hhSenior,
        householdsWithSenior: hhSenior,
        pwdCount: hhPwd,
        householdsWithPwd: hhPwd,
        soloParentCount: Number(r.solo_parent_count ?? 0),
        fisherfolkCount: Number(r.fisherfolk_count ?? 0),
        farmerCount: Number(r.farmer_count ?? 0),
        unemployedCount: Number(r.unemployed_count ?? 0),
        underemployedCount: Number(r.underemployed_count ?? 0),
        ofwCount: Number(r.ofw_count ?? 0),
        foodInsecureHouseholds: Number(r.food_insecure_households ?? 0),
        unimprovedWaterHouseholds: Number(r.unimproved_water_households ?? 0),
        unimprovedSanitationHouseholds: Number(r.unimproved_sanitation_households ?? 0),
        makeshiftHousingHouseholds: Number(r.makeshift_housing_households ?? 0),
        noElectricityHouseholds: Number(r.no_electricity_households ?? 0),
        noInternetHouseholds: Number(r.no_internet_households ?? 0),
        disasterShockHouseholds: Number(r.disaster_shock_households ?? 0),
        indicatorCounts,
      };
    });

    return {
      summary: {
        surveyYear: query.surveyYear,
        reportType: 'BARANGAY_SUMMARY',
        barangayGeoCode: query.barangayGeoCode,
        criteria: query.criteria,
        matchMode: query.matchMode,
        waiverOnly: Boolean(query.waiverOnly),
        usingSampleFallback: false,
        totalMatchingRows: barangayRows.length,
        totalHouseholdsCovered: barangayRows.reduce((s, r) => s + r.matchingHouseholds, 0),
        totalPopulationCovered: barangayRows.reduce((s, r) => s + r.totalPopulation, 0),
        totalPoorHouseholds: barangayRows.reduce((s, r) => s + r.poorHouseholds, 0),
        totalFourPsHouseholds: barangayRows.reduce((s, r) => s + r.fourPsHouseholds, 0),
        totalOutOfSchoolYouth: barangayRows.reduce((s, r) => s + r.outOfSchoolYouthCount, 0),
        totalSeniorCitizens: barangayRows.reduce((s, r) => s + r.seniorCitizensCount, 0),
        totalPwdMembers: barangayRows.reduce((s, r) => s + r.pwdCount, 0),
        prunedHouseholdTablesJoined: Array.from(householdTables),
        prunedMemberTablesJoined: Array.from(memberTables),
      },
      barangayRows,
    };
  }

  if (query.reportType === 'HOUSEHOLD_ROSTER') {
    const limit = exportAll ? 50000 : (query.limit ?? 50);
    const offset = exportAll ? 0 : (query.offset ?? 0);

    const hhSql = `
        SELECT
          h.id::text AS id,
          h.cbms_uuid::text AS cbms_uuid,
          COALESCE(h.husn, '') AS husn,
          COALESCE(h.hsn, '') AS hsn,
          h.barangay_geo_code,
          COALESCE(b.name, h.barangay_name, '') AS barangay_name,
          COALESCE(h.address_sitio_purok, '') AS sitio_purok,
          COALESCE(h.address_house_number, '') AS house_number,
          COALESCE(head_mem.head_name, 'Household Head') AS head_name,
          COALESCE(h.hh_size, 1)::int AS hh_size,
          COALESCE(h.number_of_males, 0)::int AS males,
          COALESCE(h.number_of_females, 0)::int AS females,
          h.longitude,
          h.latitude,
          (COALESCE(h.agree_to_sign_the_waiver, 1) = 1) AS waiver_consented,
          (COALESCE(hp.poor, 0) = 1) AS poor,
          (COALESCE(hp.near_poor_5_pct, 0) = 1) AS near_poor_5,
          (COALESCE(hsp.m05_a_4ps, 0) = 1) AS four_ps_beneficiary,
          (COALESCE(hho.o11_electricity, 0) = 1) AS electricity,
          (COALESCE(hcs.k02_internet_at_home, 0) = 1) AS internet_at_home,
          (${getHouseholdIndicatorSqlPredicate('senior_citizen')}) AS has_senior_citizen,
          (${getHouseholdIndicatorSqlPredicate('pwd')}) AS has_pwd,
          (${getHouseholdIndicatorSqlPredicate('solo_parent')}) AS has_solo_parent,
          (${getHouseholdIndicatorSqlPredicate('out_of_school_youth')}) AS has_osy,
          (${getHouseholdIndicatorSqlPredicate('fisherfolk')}) AS has_fisherfolk,
          (${getHouseholdIndicatorSqlPredicate('farmer')}) AS has_farmer,
          (${getHouseholdIndicatorSqlPredicate('food_insecure')}) AS food_insecure,
          (${getHouseholdIndicatorSqlPredicate('unimproved_water')}) AS unimproved_water,
          (${getHouseholdIndicatorSqlPredicate('makeshift_housing')}) AS makeshift_housing,
          (${getHouseholdIndicatorSqlPredicate('disaster_shock')}) AS disaster_shock,
          COUNT(*) OVER()::int AS total_matching
        FROM public.households h
        JOIN public.survey_years sy ON sy.id = h.survey_year_id
        JOIN public.barangays b ON b.barangay_geo_code = h.barangay_geo_code
        LEFT JOIN public.household_poverty hp ON hp.household_id = h.id
        LEFT JOIN public.household_social_protection hsp ON hsp.household_id = h.id
        LEFT JOIN public.household_food_security hfs ON hfs.household_id = h.id
        LEFT JOIN public.household_financial_accounts hfa ON hfa.household_id = h.id
        LEFT JOIN public.household_health hh_health ON hh_health.household_id = h.id
        LEFT JOIN public.household_wash hw ON hw.household_id = h.id
        LEFT JOIN public.household_housing hho ON hho.household_id = h.id
        LEFT JOIN public.household_assets ha ON ha.household_id = h.id
        LEFT JOIN public.household_connectivity_safety hcs ON hcs.household_id = h.id
        LEFT JOIN public.household_disaster_shocks hds ON hds.household_id = h.id
        LEFT JOIN LATERAL (
          SELECT CONCAT(COALESCE(mdc.a01_first_name, ''), ' ', COALESCE(mdc.a01_last_name, '')) AS head_name
          FROM public.household_members hm
          JOIN public.member_demographics_core mdc ON mdc.member_id = hm.id
          WHERE hm.household_id = h.id
          ORDER BY hm.line_number ASC
          LIMIT 1
        ) head_mem ON true
        WHERE sy.survey_year = $1
          ${brgyClause}
          ${waiverClause}
          ${hhSearchClause}
          AND ${criteriaWhereClause}
        ORDER BY h.barangay_geo_code ASC, h.husn ASC
        LIMIT ${limit} OFFSET ${offset};
      `;

    const hhRes = await pool.query(hhSql, params);
    const totalMatching = Number(hhRes.rows[0]?.total_matching ?? 0);

    const householdRows: HouseholdReportRosterRow[] = hhRes.rows.map((r) => {
      const matched: ReportIndicatorId[] = [];
      if (r.poor) matched.push('poor');
      if (r.near_poor_5) matched.push('near_poor_5');
      if (r.four_ps_beneficiary) matched.push('beneficiary_4ps');
      if (r.poor && !r.four_ps_beneficiary) matched.push('no_4ps_poor');
      if (!r.electricity) matched.push('no_electricity');
      if (!r.internet_at_home) matched.push('no_internet');
      if (r.internet_at_home) matched.push('with_internet');
      if (r.has_senior_citizen) matched.push('senior_citizen');
      if (r.has_pwd) matched.push('pwd');
      if (r.has_solo_parent) matched.push('solo_parent');
      if (r.has_osy) matched.push('out_of_school_youth');
      if (r.has_fisherfolk) matched.push('fisherfolk');
      if (r.has_farmer) matched.push('farmer');
      if (r.food_insecure) matched.push('food_insecure');
      if (r.unimproved_water) matched.push('unimproved_water');
      if (r.makeshift_housing) matched.push('makeshift_housing');
      if (r.disaster_shock) matched.push('disaster_shock');
      for (const c of query.criteria) {
        if (!matched.includes(c)) matched.push(c);
      }

      return {
        id: String(r.id),
        cbmsUuid: String(r.cbms_uuid),
        husn: String(r.husn),
        hsn: String(r.hsn),
        barangayGeoCode: String(r.barangay_geo_code),
        barangayName: String(r.barangay_name),
        sitioPurok: String(r.sitio_purok),
        houseNumber: String(r.house_number),
        headName: String(r.head_name).trim() || 'Household Head',
        hhSize: Number(r.hh_size ?? 1),
        males: Number(r.males ?? 0),
        females: Number(r.females ?? 0),
        longitude: r.longitude !== null ? Number(r.longitude) : null,
        latitude: r.latitude !== null ? Number(r.latitude) : null,
        waiverConsented: Boolean(r.waiver_consented),
        poor: Boolean(r.poor),
        nearPoor5: Boolean(r.near_poor_5),
        fourPsBeneficiary: Boolean(r.four_ps_beneficiary),
        electricity: Boolean(r.electricity),
        internetAtHome: Boolean(r.internet_at_home),
        hasSeniorCitizen: Boolean(r.has_senior_citizen),
        hasPwd: Boolean(r.has_pwd),
        hasSoloParent: Boolean(r.has_solo_parent),
        hasOutOfSchoolYouth: Boolean(r.has_osy),
        hasFisherfolk: Boolean(r.has_fisherfolk),
        hasFarmer: Boolean(r.has_farmer),
        foodInsecure: Boolean(r.food_insecure),
        unimprovedWater: Boolean(r.unimproved_water),
        makeshiftHousing: Boolean(r.makeshift_housing),
        disasterShock: Boolean(r.disaster_shock),
        matchedIndicators: matched,
      };
    });

    const sanitizedHouseholdRows = householdRows.map((h) =>
      sanitizeHouseholdRowForRole(h, role),
    );

    return {
      summary: {
        surveyYear: query.surveyYear,
        reportType: 'HOUSEHOLD_ROSTER',
        barangayGeoCode: query.barangayGeoCode,
        criteria: query.criteria,
        matchMode: query.matchMode,
        waiverOnly: Boolean(query.waiverOnly),
        usingSampleFallback: false,
        totalMatchingRows: totalMatching,
        totalHouseholdsCovered: totalMatching,
        totalPopulationCovered: sanitizedHouseholdRows.reduce((s, r) => s + r.hhSize, 0),
        totalPoorHouseholds: sanitizedHouseholdRows.filter((r) => r.poor).length,
        totalFourPsHouseholds: sanitizedHouseholdRows.filter((r) => r.fourPsBeneficiary).length,
        totalOutOfSchoolYouth: sanitizedHouseholdRows.filter((r) => r.hasOutOfSchoolYouth).length,
        totalSeniorCitizens: sanitizedHouseholdRows.filter((r) => r.hasSeniorCitizen).length,
        totalPwdMembers: sanitizedHouseholdRows.filter((r) => r.hasPwd).length,
        prunedHouseholdTablesJoined: Array.from(householdTables),
        prunedMemberTablesJoined: Array.from(memberTables),
      },
      householdRows: sanitizedHouseholdRows,
    };
  }

  // MEMBER_ROSTER
  const limit = exportAll ? 50000 : (query.limit ?? 50);
  const offset = exportAll ? 0 : (query.offset ?? 0);

  const memSql = `
      SELECT
        hm.id::text AS member_id,
        h.id::text AS household_id,
        h.cbms_uuid::text AS cbms_uuid,
        h.barangay_geo_code,
        COALESCE(b.name, h.barangay_name, '') AS barangay_name,
        COALESCE(h.address_sitio_purok, '') AS sitio_purok,
        COALESCE(h.husn, '') AS husn,
        COALESCE(h.hsn, '') AS hsn,
        hm.line_number,
        COALESCE(mdc.a01_last_name, '') AS last_name,
        COALESCE(mdc.a01_first_name, '') AS first_name,
        COALESCE(mdc.a01_middle_name, '') AS middle_name,
        COALESCE(mdc.a01_suffix, '') AS suffix,
        CASE WHEN mdc.a03_sex = 1 THEN 'Male' ELSE 'Female' END AS sex,
        COALESCE(mdc.a05_age, 0)::int AS age,
        CASE
          WHEN mdc.a02_relation_to_hh_head = 1 THEN 'Head'
          WHEN mdc.a02_relation_to_hh_head = 2 THEN 'Spouse'
          ELSE 'Child / Member'
        END AS relation_to_head,
        (COALESCE(mdc.a05_age, 0) >= 60) AS is_senior,
        (COALESCE(mdo.b10_pwd, 0) = 1) AS is_pwd,
        (COALESCE(mdo.b05_solo_parent, 0) = 1) AS is_solo_parent,
        (COALESCE(mdc.a05_age, 0) BETWEEN 6 AND 24 AND COALESCE(med.d01_currently_attending_school, 2) = 2) AS is_osy,
        (COALESCE(med.d01_currently_attending_school, 0) = 1) AS attending_school,
        (COALESCE(mec.e18_fisherfolk, 0) = 1) AS is_fisherfolk,
        (COALESCE(mec.e17_farmer, 0) = 1) AS is_farmer,
        (COALESCE(mec.e01_employment_status, 0) = 2 OR COALESCE(mec.e13_try_look_for_work, 0) = 1) AS is_unemployed,
        CASE
          WHEN mec.e18_fisherfolk = 1 THEN 'Fisherfolk'
          WHEN mec.e17_farmer = 1 THEN 'Farmer'
          WHEN mec.e01_employment_status = 1 THEN 'Employed'
          WHEN med.d01_currently_attending_school = 1 THEN 'Student'
          ELSE 'Dependent / Homemaker'
        END AS occupation,
        (COALESCE(hp.poor, 0) = 1) AS household_poor,
        (COALESCE(hsp.m05_a_4ps, 0) = 1) AS four_ps_beneficiary,
        (COALESCE(h.agree_to_sign_the_waiver, 1) = 1) AS waiver_consented,
        h.longitude,
        h.latitude,
        COUNT(*) OVER()::int AS total_matching
      FROM public.household_members hm
      JOIN public.households h ON h.id = hm.household_id
      JOIN public.survey_years sy ON sy.id = h.survey_year_id
      JOIN public.barangays b ON b.barangay_geo_code = h.barangay_geo_code
      LEFT JOIN public.member_demographics_core mdc ON mdc.member_id = hm.id
      LEFT JOIN public.member_demographics_other mdo ON mdo.member_id = hm.id
      LEFT JOIN public.member_migration mm ON mm.member_id = hm.id
      LEFT JOIN public.member_education med ON med.member_id = hm.id
      LEFT JOIN public.member_economics mec ON mec.member_id = hm.id
      LEFT JOIN public.household_poverty hp ON hp.household_id = h.id
      LEFT JOIN public.household_social_protection hsp ON hsp.household_id = h.id
      LEFT JOIN public.household_food_security hfs ON hfs.household_id = h.id
      LEFT JOIN public.household_financial_accounts hfa ON hfa.household_id = h.id
      LEFT JOIN public.household_health hh_health ON hh_health.household_id = h.id
      LEFT JOIN public.household_wash hw ON hw.household_id = h.id
      LEFT JOIN public.household_housing hho ON hho.household_id = h.id
      LEFT JOIN public.household_assets ha ON ha.household_id = h.id
      LEFT JOIN public.household_connectivity_safety hcs ON hcs.household_id = h.id
      LEFT JOIN public.household_disaster_shocks hds ON hds.household_id = h.id
      WHERE sy.survey_year = $1
        ${brgyClause}
        ${waiverClause}
        ${memSearchClause}
        AND ${memberCriteriaWhereClause}
      ORDER BY h.barangay_geo_code ASC, h.husn ASC, hm.line_number ASC
      LIMIT ${limit} OFFSET ${offset};
    `;

  const memRes = await pool.query(memSql, params);
  const totalMatching = Number(memRes.rows[0]?.total_matching ?? 0);

  const memberRows: MemberReportRosterRow[] = memRes.rows.map((r) => {
    const matched: ReportIndicatorId[] = [];
    if (r.is_senior) matched.push('senior_citizen');
    if (r.is_pwd) matched.push('pwd');
    if (r.is_solo_parent) matched.push('solo_parent');
    if (r.is_osy) matched.push('out_of_school_youth');
    if (r.attending_school) matched.push('attending_school');
    if (r.is_fisherfolk) matched.push('fisherfolk');
    if (r.is_farmer) matched.push('farmer');
    if (r.is_unemployed) matched.push('unemployed');
    if (r.household_poor) matched.push('poor');
    if (r.four_ps_beneficiary) matched.push('beneficiary_4ps');
    for (const c of query.criteria) {
      if (!matched.includes(c)) matched.push(c);
    }

    return {
      memberId: String(r.member_id),
      householdId: String(r.household_id),
      cbmsUuid: String(r.cbms_uuid),
      barangayGeoCode: String(r.barangay_geo_code),
      barangayName: String(r.barangay_name),
      sitioPurok: String(r.sitio_purok),
      husn: String(r.husn),
      hsn: String(r.hsn),
      lineNumber: String(r.line_number),
      lastName: String(r.last_name),
      firstName: String(r.first_name),
      middleName: String(r.middle_name),
      suffix: String(r.suffix),
      sex: r.sex === 'Male' ? 'Male' : 'Female',
      age: Number(r.age ?? 0),
      relationToHead: String(r.relation_to_head),
      isSeniorCitizen: Boolean(r.is_senior),
      isPwd: Boolean(r.is_pwd),
      isSoloParent: Boolean(r.is_solo_parent),
      isOutOfSchoolYouth: Boolean(r.is_osy),
      attendingSchool: Boolean(r.attending_school),
      isFisherfolk: Boolean(r.is_fisherfolk),
      isFarmer: Boolean(r.is_farmer),
      isUnemployed: Boolean(r.is_unemployed),
      occupation: String(r.occupation),
      householdPoor: Boolean(r.household_poor),
      fourPsBeneficiary: Boolean(r.four_ps_beneficiary),
      waiverConsented: Boolean(r.waiver_consented),
      longitude: r.longitude !== null ? Number(r.longitude) : null,
      latitude: r.latitude !== null ? Number(r.latitude) : null,
      matchedIndicators: matched,
    };
  });

  return {
    summary: {
      surveyYear: query.surveyYear,
      reportType: 'MEMBER_ROSTER',
      barangayGeoCode: query.barangayGeoCode,
      criteria: query.criteria,
      matchMode: query.matchMode,
      waiverOnly: Boolean(query.waiverOnly),
      usingSampleFallback: false,
      totalMatchingRows: totalMatching,
      totalHouseholdsCovered: new Set(memberRows.map((m) => m.householdId)).size,
      totalPopulationCovered: totalMatching,
      totalPoorHouseholds: memberRows.filter((m) => m.householdPoor).length,
      totalFourPsHouseholds: memberRows.filter((m) => m.fourPsBeneficiary).length,
      totalOutOfSchoolYouth: memberRows.filter((m) => m.isOutOfSchoolYouth).length,
      totalSeniorCitizens: memberRows.filter((m) => m.isSeniorCitizen).length,
      totalPwdMembers: memberRows.filter((m) => m.isPwd).length,
      prunedHouseholdTablesJoined: Array.from(householdTables),
      prunedMemberTablesJoined: Array.from(memberTables),
    },
    memberRows,
  };
}

/**
 * Maps a report response + active criteria into flat exportable records (headers + row objects)
 * for both Excel (.xlsx) and CSV (.csv) exports.
 */
export function buildExportTabularRows(
  data: ReportPreviewResponse,
  query: ReportFilterQuery,
  role: UserRole = 'ADMIN',
): {
  columns: Array<{ key: string; header: string; width: number }>;
  rows: Array<Record<string, string | number>>;
} {
  const includeMemberData = canAccessMemberData(role);
  const activeIndicators = query.criteria
    .map((id) => REPORT_INDICATOR_MAP.get(id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  if (query.reportType === 'BARANGAY_SUMMARY') {
    const baseCols: Array<{ key: string; header: string; width: number }> = [
      { key: 'barangayGeoCode', header: 'PSGC Code', width: 15 },
      { key: 'barangayName', header: 'Barangay Name', width: 22 },
      { key: 'totalHouseholds', header: 'Total Households', width: 18 },
      { key: 'totalPopulation', header: 'Total Population', width: 18 },
      { key: 'matchingHouseholds', header: 'Matching Filter Count', width: 22 },
      { key: 'matchingRate', header: 'Matching Rate (%)', width: 18 },
      { key: 'poorHouseholds', header: 'Poor Households', width: 18 },
      { key: 'poorRate', header: 'Poverty Rate (%)', width: 18 },
      { key: 'fourPsHouseholds', header: '4Ps Beneficiaries (HH)', width: 22 },
      { key: 'no4psPoorHouseholds', header: '4Ps Gap (Poor No 4Ps)', width: 22 },
      { key: 'outOfSchoolYouthCount', header: 'Out-of-School Youth (OSY)', width: 25 },
      { key: 'seniorCitizensCount', header: 'Senior Citizens (60+)', width: 22 },
      { key: 'pwdCount', header: 'Persons with Disability (PWD)', width: 26 },
      { key: 'soloParentCount', header: 'Solo Parents', width: 16 },
      { key: 'fisherfolkCount', header: 'Fisherfolk', width: 16 },
      { key: 'farmerCount', header: 'Farmers', width: 16 },
      { key: 'foodInsecureHouseholds', header: 'Food Insecure (HH)', width: 20 },
      { key: 'unimprovedWaterHouseholds', header: 'Unimproved Water (HH)', width: 22 },
      { key: 'makeshiftHousingHouseholds', header: 'Light/Salvaged Housing (HH)', width: 25 },
      { key: 'noElectricityHouseholds', header: 'No Electricity (HH)', width: 20 },
      { key: 'noInternetHouseholds', header: 'No Home Internet (HH)', width: 22 },
      { key: 'disasterShockHouseholds', header: 'Climate/Disaster Shock (HH)', width: 25 },
    ];

    for (const ind of activeIndicators) {
      const dynKey = `ind_${ind.id}`;
      if (!baseCols.some((c) => c.key === dynKey)) {
        baseCols.push({
          key: dynKey,
          header: `[Filter] ${ind.shortLabel}`,
          width: 24,
        });
      }
    }

    const brgyRows = data.barangayRows ?? [];
    const rows: Array<Record<string, string | number>> = brgyRows.map((r) => {
      const rec: Record<string, string | number> = {
        barangayGeoCode: r.barangayGeoCode,
        barangayName: r.barangayName,
        totalHouseholds: r.totalHouseholds,
        totalPopulation: r.totalPopulation,
        matchingHouseholds: r.matchingHouseholds,
        matchingRate: r.matchingRate,
        poorHouseholds: r.poorHouseholds,
        poorRate: r.poorRate,
        fourPsHouseholds: r.fourPsHouseholds,
        no4psPoorHouseholds: r.no4psPoorHouseholds,
        outOfSchoolYouthCount: r.outOfSchoolYouthCount,
        seniorCitizensCount: r.seniorCitizensCount,
        pwdCount: r.pwdCount,
        soloParentCount: r.soloParentCount,
        fisherfolkCount: r.fisherfolkCount,
        farmerCount: r.farmerCount,
        foodInsecureHouseholds: r.foodInsecureHouseholds,
        unimprovedWaterHouseholds: r.unimprovedWaterHouseholds,
        makeshiftHousingHouseholds: r.makeshiftHousingHouseholds,
        noElectricityHouseholds: r.noElectricityHouseholds,
        noInternetHouseholds: r.noInternetHouseholds,
        disasterShockHouseholds: r.disasterShockHouseholds,
      };
      for (const ind of activeIndicators) {
        rec[`ind_${ind.id}`] = r.indicatorCounts[ind.id] ?? 0;
      }
      return rec;
    });

    return { columns: baseCols, rows };
  }

  if (query.reportType === 'HOUSEHOLD_ROSTER') {
    const cols: Array<{ key: string; header: string; width: number }> = [
      { key: 'cbmsUuid', header: 'CBMS Household UUID', width: 38 },
      { key: 'barangayGeoCode', header: 'PSGC Code', width: 14 },
      { key: 'barangayName', header: 'Barangay', width: 20 },
      { key: 'sitioPurok', header: 'Sitio / Purok', width: 22 },
      { key: 'houseNumber', header: 'House / Lot No.', width: 18 },
      { key: 'husn', header: 'HUSN', width: 14 },
      { key: 'hsn', header: 'HSN', width: 14 },
      ...(includeMemberData
        ? [{ key: 'headName', header: 'Household Head Name', width: 26 }]
        : []),
      { key: 'hhSize', header: 'HH Size', width: 12 },
      { key: 'males', header: 'Males', width: 10 },
      { key: 'females', header: 'Females', width: 10 },
      { key: 'poor', header: 'Poor Status', width: 14 },
      { key: 'nearPoor5', header: 'Near-Poor (+5%)', width: 16 },
      { key: 'fourPsBeneficiary', header: '4Ps Beneficiary', width: 16 },
      ...(includeMemberData
        ? [
            { key: 'hasOutOfSchoolYouth', header: 'With OSY', width: 14 },
            { key: 'hasSeniorCitizen', header: 'With Senior (60+)', width: 18 },
            { key: 'hasPwd', header: 'With PWD', width: 14 },
            { key: 'hasSoloParent', header: 'With Solo Parent', width: 18 },
            { key: 'hasFisherfolk', header: 'With Fisherfolk', width: 16 },
            { key: 'hasFarmer', header: 'With Farmer', width: 14 },
          ]
        : []),
      { key: 'electricity', header: 'Electricity', width: 14 },
      { key: 'internetAtHome', header: 'Home Internet', width: 16 },
      { key: 'foodInsecure', header: 'Food Insecure (HH)', width: 18 },
      { key: 'unimprovedWater', header: 'Unimproved Water (HH)', width: 20 },
      { key: 'makeshiftHousing', header: 'Light/Salvaged Housing', width: 22 },
      { key: 'disasterShock', header: 'Climate/Disaster Shock', width: 22 },
      { key: 'waiverConsented', header: 'Form 3 Waiver Consent', width: 22 },
      { key: 'longitude', header: 'Longitude (WGS84)', width: 18 },
      { key: 'latitude', header: 'Latitude (WGS84)', width: 18 },
      { key: 'matchedCriteriaLabels', header: 'Matched CBMS Indicators', width: 42 },
    ];

    const hhRows = (data.householdRows ?? []).map((h) =>
      sanitizeHouseholdRowForRole(h, role),
    );
    const rows: Array<Record<string, string | number>> = hhRows.map((h) => ({
      cbmsUuid: h.cbmsUuid,
      barangayGeoCode: h.barangayGeoCode,
      barangayName: h.barangayName,
      sitioPurok: h.sitioPurok,
      houseNumber: h.houseNumber,
      husn: h.husn,
      hsn: h.hsn,
      headName: h.headName,
      hhSize: h.hhSize,
      males: h.males,
      females: h.females,
      poor: h.poor ? 'Yes (Poor)' : 'No',
      nearPoor5: h.nearPoor5 ? 'Yes' : 'No',
      fourPsBeneficiary: h.fourPsBeneficiary ? 'Yes (4Ps)' : 'No',
      hasOutOfSchoolYouth: h.hasOutOfSchoolYouth ? 'Yes' : 'No',
      hasSeniorCitizen: h.hasSeniorCitizen ? 'Yes' : 'No',
      hasPwd: h.hasPwd ? 'Yes' : 'No',
      hasSoloParent: h.hasSoloParent ? 'Yes' : 'No',
      hasFisherfolk: h.hasFisherfolk ? 'Yes' : 'No',
      hasFarmer: h.hasFarmer ? 'Yes' : 'No',
      electricity: h.electricity ? 'Connected' : 'None',
      internetAtHome: h.internetAtHome ? 'Yes' : 'No',
      foodInsecure: h.foodInsecure ? 'Yes' : 'No',
      unimprovedWater: h.unimprovedWater ? 'Yes' : 'No',
      makeshiftHousing: h.makeshiftHousing ? 'Yes' : 'No',
      disasterShock: h.disasterShock ? 'Yes' : 'No',
      waiverConsented: h.waiverConsented ? 'Signed (Yes)' : 'No',
      longitude: h.longitude ?? '',
      latitude: h.latitude ?? '',
      matchedCriteriaLabels: h.matchedIndicators
        .map((id) => REPORT_INDICATOR_MAP.get(id)?.shortLabel ?? id)
        .join('; '),
    }));

    return { columns: cols, rows };
  }

  // MEMBER_ROSTER
  const cols: Array<{ key: string; header: string; width: number }> = [
    { key: 'cbmsUuid', header: 'CBMS Household UUID', width: 38 },
    { key: 'barangayName', header: 'Barangay', width: 20 },
    { key: 'sitioPurok', header: 'Sitio / Purok', width: 22 },
    { key: 'husn', header: 'HUSN', width: 14 },
    { key: 'hsn', header: 'HSN', width: 14 },
    { key: 'lineNumber', header: 'Line No.', width: 10 },
    { key: 'lastName', header: 'Last Name', width: 20 },
    { key: 'firstName', header: 'First Name', width: 20 },
    { key: 'middleName', header: 'Middle Name', width: 18 },
    { key: 'sex', header: 'Sex', width: 10 },
    { key: 'age', header: 'Age', width: 10 },
    { key: 'relationToHead', header: 'Relation to Head', width: 18 },
    { key: 'occupation', header: 'Livelihood / Occupation', width: 24 },
    { key: 'isOutOfSchoolYouth', header: 'Out-of-School Youth (OSY)', width: 24 },
    { key: 'attendingSchool', header: 'Attending School', width: 18 },
    { key: 'isSeniorCitizen', header: 'Senior Citizen (60+)', width: 20 },
    { key: 'isPwd', header: 'PWD', width: 12 },
    { key: 'isSoloParent', header: 'Solo Parent', width: 14 },
    { key: 'isFisherfolk', header: 'Fisherfolk', width: 14 },
    { key: 'isFarmer', header: 'Farmer', width: 14 },
    { key: 'householdPoor', header: 'HH Poverty Status', width: 18 },
    { key: 'fourPsBeneficiary', header: 'HH 4Ps Status', width: 16 },
    { key: 'longitude', header: 'Longitude (WGS84)', width: 18 },
    { key: 'latitude', header: 'Latitude (WGS84)', width: 18 },
  ];

  const memRows = data.memberRows ?? [];
  const rows: Array<Record<string, string | number>> = memRows.map((m) => ({
    cbmsUuid: m.cbmsUuid,
    barangayName: m.barangayName,
    sitioPurok: m.sitioPurok,
    husn: m.husn,
    hsn: m.hsn,
    lineNumber: m.lineNumber,
    lastName: m.lastName,
    firstName: m.firstName,
    middleName: m.middleName,
    sex: m.sex,
    age: m.age,
    relationToHead: m.relationToHead,
    occupation: m.occupation,
    isOutOfSchoolYouth: m.isOutOfSchoolYouth ? 'Yes (OSY)' : 'No',
    attendingSchool: m.attendingSchool ? 'Yes' : 'No',
    isSeniorCitizen: m.isSeniorCitizen ? 'Yes (60+)' : 'No',
    isPwd: m.isPwd ? 'Yes (PWD)' : 'No',
    isSoloParent: m.isSoloParent ? 'Yes' : 'No',
    isFisherfolk: m.isFisherfolk ? 'Yes' : 'No',
    isFarmer: m.isFarmer ? 'Yes' : 'No',
    householdPoor: m.householdPoor ? 'Poor' : 'Non-Poor',
    fourPsBeneficiary: m.fourPsBeneficiary ? '4Ps Beneficiary' : 'Non-4Ps',
    longitude: m.longitude ?? '',
    latitude: m.latitude ?? '',
  }));

  return { columns: cols, rows };
}

/**
 * Generates an official formatted LGU Excel (.xlsx) Buffer using ExcelJS.
 */
export async function generateExcelReportBuffer(
  data: ReportPreviewResponse,
  query: ReportFilterQuery,
  role: UserRole,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CBMS Web-GIS Decision Support Platform — LGU San Jose, Dinagat Islands';
  workbook.created = new Date();

  const sheetTitle =
    query.reportType === 'BARANGAY_SUMMARY'
      ? 'Barangay Summary Report'
      : query.reportType === 'HOUSEHOLD_ROSTER'
        ? 'Household Beneficiary Roster'
        : 'Individual Member Roster';

  const sheet = workbook.addWorksheet(sheetTitle);
  const { columns, rows } = buildExportTabularRows(data, query, role);

  const criteriaLabels =
    query.criteria.length > 0
      ? query.criteria
          .map((id) => REPORT_INDICATOR_MAP.get(id)?.label ?? id)
          .join(query.matchMode === 'all' ? ' AND ' : ' OR ')
      : 'All Enumerated CBMS Records (No Filter Applied)';

  // Title & Metadata Header Block
  sheet.addRow([
    'REPUBLIC OF THE PHILIPPINES • PROVINCE OF DINAGAT ISLANDS • MUNICIPALITY OF SAN JOSE (PSGC 1608506)',
  ]);
  sheet.addRow([
    `CBMS WEB-GIS SOCIO-ECONOMIC & SPATIAL ANALYTICS REPORT — ${sheetTitle.toUpperCase()} (${query.surveyYear})`,
  ]);
  sheet.addRow([
    `Legal Compliance: RA 11315 (CBMS Act) & RA 10173 (Data Privacy Act of 2012) • Generated Role: ${role} • Barangay Scope: ${query.barangayGeoCode}`,
  ]);
  sheet.addRow([
    `Active CBMS Dimension Criteria (${query.matchMode.toUpperCase()}): ${criteriaLabels}${query.waiverOnly ? ' • [Form 3 Waiver Consented Only]' : ''}`,
  ]);
  sheet.addRow([]);

  sheet.getRow(1).font = { bold: true, size: 11 };
  sheet.getRow(2).font = { bold: true, size: 12 };
  sheet.getRow(3).font = { italic: true, size: 10 };
  sheet.getRow(4).font = { bold: true, size: 10 };

  // Table Header Row (Row 6)
  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };

  columns.forEach((col, idx) => {
    const excelCol = sheet.getColumn(idx + 1);
    excelCol.width = col.width;
  });

  // Data Rows
  for (const rowObj of rows) {
    sheet.addRow(columns.map((c) => rowObj[c.key] ?? ''));
  }

  // Municipal Totals Footer Row for BARANGAY_SUMMARY
  if (query.reportType === 'BARANGAY_SUMMARY' && (data.barangayRows?.length ?? 0) > 0) {
    const brgyList = data.barangayRows!;
    const sumField = (fn: (b: BarangayAggregatedReportRow) => number) =>
      brgyList.reduce((acc, b) => acc + fn(b), 0);

    const totalHh = sumField((b) => b.totalHouseholds);
    const totalMatch = sumField((b) => b.matchingHouseholds);
    const totalPoor = sumField((b) => b.poorHouseholds);

    const footerObj: Record<string, string | number> = {
      barangayGeoCode: '1608506',
      barangayName: 'MUNICIPAL TOTAL (SAN JOSE)',
      totalHouseholds: totalHh,
      totalPopulation: sumField((b) => b.totalPopulation),
      matchingHouseholds: totalMatch,
      matchingRate: totalHh > 0 ? Number(((totalMatch / totalHh) * 100).toFixed(1)) : 0,
      poorHouseholds: totalPoor,
      poorRate: totalHh > 0 ? Number(((totalPoor / totalHh) * 100).toFixed(1)) : 0,
      fourPsHouseholds: sumField((b) => b.fourPsHouseholds),
      no4psPoorHouseholds: sumField((b) => b.no4psPoorHouseholds),
      outOfSchoolYouthCount: sumField((b) => b.outOfSchoolYouthCount),
      seniorCitizensCount: sumField((b) => b.seniorCitizensCount),
      pwdCount: sumField((b) => b.pwdCount),
      soloParentCount: sumField((b) => b.soloParentCount),
      fisherfolkCount: sumField((b) => b.fisherfolkCount),
      farmerCount: sumField((b) => b.farmerCount),
      foodInsecureHouseholds: sumField((b) => b.foodInsecureHouseholds),
      unimprovedWaterHouseholds: sumField((b) => b.unimprovedWaterHouseholds),
      makeshiftHousingHouseholds: sumField((b) => b.makeshiftHousingHouseholds),
      noElectricityHouseholds: sumField((b) => b.noElectricityHouseholds),
      noInternetHouseholds: sumField((b) => b.noInternetHouseholds),
      disasterShockHouseholds: sumField((b) => b.disasterShockHouseholds),
    };

    for (const c of query.criteria) {
      footerObj[`ind_${c}`] = sumField((b) => b.indicatorCounts[c] ?? 0);
    }

    const totalRow = sheet.addRow(columns.map((c) => footerObj[c.key] ?? ''));
    totalRow.font = { bold: true };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates a UTF-8 BOM CSV string using fast-csv so Microsoft Excel opens Philippine characters cleanly.
 */
export async function generateCsvReportString(
  data: ReportPreviewResponse,
  query: ReportFilterQuery,
  role: UserRole = 'ADMIN',
): Promise<string> {
  const { columns, rows } = buildExportTabularRows(data, query, role);
  const formattedRows = rows.map((rowObj) => {
    const out: Record<string, string | number> = {};
    for (const col of columns) {
      out[col.header] = rowObj[col.key] ?? '';
    }
    return out;
  });

  const csvBody = await writeToString(formattedRows, {
    headers: columns.map((c) => c.header),
    writeHeaders: true,
  });

  return `\uFEFF${csvBody}`;
}

export { CBMS_REPORT_INDICATORS };
