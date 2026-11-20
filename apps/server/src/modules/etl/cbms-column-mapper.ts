import type { EtlValidationWarning } from '@cbms/shared';

export const MEMBER_DEMO_CORE_COLS = [
  'a01_last_name',
  'a01_first_name',
  'a01_suffix',
  'a01_middle_name',
  'a02_relation_to_hh_head',
  'a03_sex',
  'a04_birthday_month',
  'a04_birthday_day',
  'a04_birthday_year',
  'a05_age',
  'a05_age_group_five_years',
  'a06_lcr_reg_status',
  'a07_marital_status',
  'a08_religion',
  'a09_ethnicity',
  'a10_simple_literacy',
  'a11_hgc_level',
  'a11_hgc_group',
  'a11_hgc',
] as const;

export const MEMBER_DEMO_OTHER_COLS = [
  'b01_nuclear_family',
  'b02_relation_to_nuclear_family_head',
  'b03_phil_id',
  'b05_solo_parent',
  'b06_solo_parent_id',
  'b07_senior_citizen_id',
  'b08_currently_pregnant',
  'b09_lactating_mother',
  'b10_pwd',
  'b11_with_pwd_id',
  'b12_a_visual_disability',
  'b12_b_hearing_disability',
  'b12_c_mental_disability',
  'b12_d_physical_disability',
  'b12_e_speech_impairment',
  'b12_f_cancer',
  'b12_g_rare_disease',
  'b12_z_other_disability',
  'b13_seeing',
  'b14_hearing',
  'b15_walking',
  'b16_remembering',
  'b17_self_caring',
  'b18_communicating',
  'b19_ssdi',
  'b20_sssco',
  'b21_sssc',
] as const;

export const MEMBER_MIGRATION_COLS = [
  'c01_citizenship',
  'c02_ofi',
  'c03_ever_experienced_migration',
  'c04_migration_level',
  'c04_recent_migration_region',
  'c04_recent_migration_province',
  'c04_recent_migration_city_mun',
  'c04_recent_migration_barangay',
  'c04_recent_migration_country',
  'c05_date_of_movement_month',
  'c05_date_of_movement_year',
  'c06_internal_displacement',
] as const;

export const MEMBER_EDUCATION_COLS = [
  'd01_currently_attending_school',
  'd02_type_of_school_attended',
  'd03_current_grade_level',
  'd03_current_grade',
  'd04_a_impact',
  'd04_b_home_school',
  'd04_c_misosa',
  'd04_d_night_high_school',
  'd04_e_open_high_school',
  'd04_f_rural_farm_school',
  'd05_madrasah_program',
  'd06_reason_not_attending_school',
  'd07_tvet_graduate',
  'd08_tvet_currently_attending',
] as const;

export const MEMBER_ECONOMICS_COLS = [
  'e01_labor_force_participation',
  'e01_employment_status',
  'e01_underemployment_status',
  'e01_discouraged_worker',
  'e01_work_past_week',
  'e02_job_or_business_past_week',
  'e03_work_location_province',
  'e04_work_location_city_mun',
  'e05_psoc',
  'e05_occupation_group',
  'e06_psic',
  'e06_industry_group',
  'e07_nature_of_employment',
  'e08_class_of_worker',
  'e09_basis_of_payment',
  'e10_other_job_or_business_past_week',
  'e11_number_of_hours_worked_in_all_jobs',
  'e12_want_more_hours',
  'e13_try_look_for_work',
  'e14_reason_not_looking_for_work',
  'e15_available_for_work',
  'e16_willing_to_work',
  'e17_farmer',
  'e18_fisherfolk',
] as const;

export const HOUSEHOLD_HEALTH_COLS = [
  'f01_with_member_who_has_been_sick',
  'f02_availed_medical_treatment',
  'f03_a_public_regional_hospital',
  'f03_b_public_provincial_hospital',
  'f03_c_public_district_hospital',
  'f03_d_public_municipal_hospital',
  'f03_e_public_rhu_uhc_lying_in_clinic',
  'f03_f_public_barangay_health_center',
  'f03_g_public_mobile_clinic',
  'f03_h_public_isolation_facility',
  'f03_i_other_public_health_facility',
  'f03_j_private_hospital',
  'f03_k_private_lying_in_clinic',
  'f03_l_private_clinic',
  'f03_m_private_pharmacy',
  'f03_n_private_mobile_clinic',
  'f03_o_private_health_facility_other',
  'f03_p_alternative_hilot_herbalists',
  'f03_q_alternative_massage_center',
  'f03_r_alternative_healing',
  'f03_s_alternative_shop',
  'f03_t_alternative_faith_healer',
  'f03_z_health_facility_other',
  'f04_reason_not_availed_treatment',
  'f05_measured_annually_during_opt_plus',
  'f06_with_child_died',
  'f07_number_of_children_who_died',
] as const;

export const HOUSEHOLD_FOOD_SECURITY_COLS = [
  'g01_worried',
  'g02_not_eaten_healthy',
  'g03_ate_few_food',
  'g04_skipped_meal',
  'g05_ate_less',
  'g06_ran_out_of_food',
  'g07_hungry',
  'g08_not_eaten_whole_day',
] as const;

export const HOUSEHOLD_CONNECTIVITY_SAFETY_COLS = [
  'h01_puv_access',
  'k01_internet_access',
  'k02_internet_at_home',
  'k03_a_wired_broadband',
  'k03_b_wireless_broadband',
  'k03_c_satellite_broadband',
  'k03_d_mobile_broadband',
  'l01_safe_walking_alone',
] as const;

export const HOUSEHOLD_FINANCIAL_ACCOUNTS_COLS = [
  'i01_a_bank_account',
  'i01_b_digital_bank_account',
  'i01_c_emoney_or_cash_card',
  'i01_d_nssla',
  'i01_e_account_with_coop',
  'i01_f_microfinance',
  'i01_g_money_remittance',
  'i01_z_financial_account_other',
] as const;

export const HOUSEHOLD_DISASTER_SHOCKS_COLS = [
  'j01_a_typhoon',
  'j01_b_power_outage',
  'j01_c_drought',
  'j01_d_rain_or_flood',
  'j01_e_erosion_landslide',
  'j01_f_earthquake',
  'j01_g_volcanic_eruption',
  'j01_h_fire',
  'j01_i_pests_crops',
  'j01_j_pests_livestock',
  'j01_k_pests_crops_losses',
  'j01_l_crops_failed',
  'j01_m_livestock_died',
  'j01_n_pollution_mining',
  'j01_o_building_collapsed',
  'j01_p_increase_price',
  'j01_q_political_conflict',
  'j01_r_hh_member_death',
  'j01_s_hh_member_illness',
  'j01_t_no_water_supply',
  'j01_z_disasters_other',
  'j02_location_of_evacuation',
  'j03_contact_hotline',
] as const;

export const HOUSEHOLD_SOCIAL_PROTECTION_COLS = [
  'm01_a_sss',
  'm01_b_gsis',
  'm01_c_philhealth',
  'm01_d_health_insurance',
  'm02_a_benefit_sss',
  'm02_b_benefit_gsis',
  'm02_c_benefit_philhealth',
  'm02_d_benefit_health_insurance',
  'm03_offer_health_medical_assistance',
  'm04_benefit_health_medical_assistance',
  'm05_a_4ps',
  'm05_b_socpen',
  'm05_c_aics',
  'm05_d_food_stamp',
  'm05_e_educ_assistance',
  'm05_f_employ_assistance',
  'm05_g_lgu_assistance',
  'm05_z_assistance_other',
  'm06_a_benefit_4ps',
  'm06_b_benefit_socpen',
  'm06_c_benefit_aics',
  'm06_d_benefit_food_stamp',
  'm06_e_benefit_educ_assistance',
  'm06_f_benefit_employ_assistance',
  'm06_g_benefit_lgu_assistance',
  'm06_z_benefit_assistance_other',
] as const;

export const HOUSEHOLD_WASH_COLS = [
  'n01_main_water',
  'n02_drinking_water',
  'n03_service_level_drinking_water',
  'n03_water_for_other_purposes',
  'n04_water_source_location',
  'n05_time_to_collect_water',
  'n05_time_to_obtain_drinking_water',
  'n06_who_fetches_water',
  'n07_drinking_water_source_distance',
  'n08_toilet_facility',
  'n08_service_level_toilet_facility',
  'n09_toilet_facility_located',
  'n10_share_toilet',
  'n11_toilet_for_public_use',
  'n12_a_segregating_waste',
  'n12_b_garbage_truck',
  'n12_c_recycling_at_home',
  'n12_d_selling_away_recyclables',
  'n12_e_composting',
  'n12_f_burning',
  'n12_g_dumping_in_pit_with_cover',
  'n12_h_dumping_in_pit_without_cover',
  'n12_i_throwing_in_unhabited_locations',
  'n12_z_waste_disposal_other',
  'n13_service_level_handwashing_facility',
  'n13_handwashing_facility',
  'n14_handwashing_with_water',
  'n15_handwashing_with_soap',
  'n16_a_soap',
  'n16_b_detergent',
  'n16_c_ash_soil_or_sand',
  'n16_z_soap_other',
] as const;

export const HOUSEHOLD_HOUSING_COLS = [
  'o01_building_type',
  'o02_number_of_floors',
  'o03_roof',
  'o03_roof_strength',
  'o04_outer_walls',
  'o04_outer_walls_strength',
  'o05_floor_finishing',
  'o06_floor_strength',
  'o06_floor',
  'o07_floor_area',
  'o07_floor_area_range',
  'o08_number_of_bedrooms',
  'o09_tenure',
  'o10_year_constructed',
  'o10_year_constructed_range',
  'o11_electricity',
  'o12_fuel_for_lighting',
  'o13_fuel_for_cooking',
] as const;

export const HOUSEHOLD_ASSETS_COLS = [
  'o14_a_refrigerator',
  'o14_b_air_conditioner',
  'o14_c_washing_machine',
  'o14_d_stove_oven',
  'o14_e_radio',
  'o14_f_tv',
  'o14_g_audio_component',
  'o14_h_telephone',
  'o14_i_basic_cp',
  'o14_j_modern_cp',
  'o14_k_tablet',
  'o14_l_computer',
  'o14_m_car',
  'o14_n_van',
  'o14_o_jeep',
  'o14_p_truck',
  'o14_q_motorcycle',
  'o14_r_ebike',
  'o14_s_tricycle',
  'o14_t_bicycle',
  'o14_u_pedicab',
  'o14_v_banca_motorized',
  'o14_w_banca_nonmotorized',
] as const;

export const HOUSEHOLD_POVERTY_COLS = [
  'poor',
  'near_poor_5_pct',
  'near_poor_10_pct',
  'near_poor_15_pct',
  'near_poor_20_pct',
  'near_poor_25_pct',
] as const;

const STRING_DOMAIN_COLS = new Set<string>([
  'a01_last_name',
  'a01_first_name',
  'a01_suffix',
  'a01_middle_name',
  'c04_recent_migration_region',
  'c04_recent_migration_province',
  'c04_recent_migration_city_mun',
  'c04_recent_migration_barangay',
  'c04_recent_migration_country',
  'e03_work_location_province',
  'e04_work_location_city_mun',
  'n06_who_fetches_water',
]);

const INT32_DOMAIN_COLS = new Set<string>([
  'a08_religion',
  'a09_ethnicity',
  'a11_hgc_group',
  'a11_hgc',
  'd03_current_grade',
  'e05_psoc',
  'e06_psic',
]);

const FLOAT_DOMAIN_COLS = new Set<string>(['o07_floor_area']);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function unwrapCellValue(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if ('result' in obj) return unwrapCellValue(obj.result);
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((part: { text?: string }) => part?.text ?? '').join('');
    }
    if ('text' in obj && typeof obj.text === 'string') return obj.text;
  }
  return raw;
}

export function toNullableString(raw: unknown, maxLen?: number): string | null {
  const unwrapped = unwrapCellValue(raw);
  if (unwrapped === null || unwrapped === undefined) return null;
  const str = String(unwrapped).trim();
  if (
    !str ||
    str === 'NA' ||
    str === 'N/A' ||
    str === 'null' ||
    str === 'NULL' ||
    str === 'undefined'
  ) {
    return null;
  }
  return maxLen && str.length > maxLen ? str.slice(0, maxLen) : str;
}

export function toNullableSmallInt(raw: unknown, defaultVal: number | null = null): number | null {
  const unwrapped = unwrapCellValue(raw);
  if (unwrapped === null || unwrapped === undefined || unwrapped === '') return defaultVal;
  if (typeof unwrapped === 'boolean') return unwrapped ? 1 : 0;
  const str = String(unwrapped).trim();
  if (!str || str === 'NA' || str === 'N/A' || str === 'null' || str === 'NULL') {
    return defaultVal;
  }
  const n = Math.round(Number(str));
  if (!Number.isFinite(n) || n < -32768 || n > 32767) return defaultVal;
  return n;
}

export function toNullableInt(raw: unknown): number | null {
  const unwrapped = unwrapCellValue(raw);
  if (unwrapped === null || unwrapped === undefined || unwrapped === '') return null;
  const str = String(unwrapped).trim();
  if (!str || str === 'NA' || str === 'N/A' || str === 'null' || str === 'NULL') {
    return null;
  }
  const n = Math.round(Number(str));
  if (!Number.isFinite(n) || n < -2147483648 || n > 2147483647) return null;
  return n;
}

export function toNullableFloat(raw: unknown): number | null {
  const unwrapped = unwrapCellValue(raw);
  if (unwrapped === null || unwrapped === undefined || unwrapped === '') return null;
  const str = String(unwrapped).trim();
  if (!str || str === 'NA' || str === 'N/A' || str === 'null' || str === 'NULL') {
    return null;
  }
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

export function toNullableUuid(raw: unknown): string | null {
  const str = toNullableString(raw);
  if (!str) return null;
  return UUID_REGEX.test(str) ? str.toLowerCase() : null;
}

/**
 * Builds a lookup map from column name -> 0-based column index.
 * Also handles the 6 Poverty columns at indices 306..311 deterministically.
 */
export function buildHeaderIndexMap(headerCells: unknown[]): Map<string, number> {
  const map = new Map<string, number>();

  for (let i = 0; i < headerCells.length; i++) {
    const raw = toNullableString(headerCells[i]);
    if (!raw) continue;
    const key = raw.trim();
    if (!map.has(key)) {
      map.set(key, i);
    }
    const lower = key.toLowerCase();
    if (!map.has(lower)) {
      map.set(lower, i);
    }
  }

  // Explicit poverty threshold bindings (indices 306..311 in standard 312-col CBMS file)
  if (map.has('POOR') || map.has('poor')) {
    const poorIdx = map.get('POOR') ?? map.get('poor') ?? 306;
    map.set('poor', poorIdx);
    if (headerCells.length > poorIdx + 5) {
      map.set('near_poor_5_pct', poorIdx + 1);
      map.set('near_poor_10_pct', poorIdx + 2);
      map.set('near_poor_15_pct', poorIdx + 3);
      map.set('near_poor_20_pct', poorIdx + 4);
      map.set('near_poor_25_pct', poorIdx + 5);
    }
  } else if (headerCells.length >= 312) {
    map.set('poor', 306);
    map.set('near_poor_5_pct', 307);
    map.set('near_poor_10_pct', 308);
    map.set('near_poor_15_pct', 309);
    map.set('near_poor_20_pct', 310);
    map.set('near_poor_25_pct', 311);
  }

  return map;
}

export function isCbmsHeaderRow(cells: unknown[]): boolean {
  if (!cells || cells.length < 15) return false;
  const c0 = toNullableString(cells[0])?.toLowerCase();
  const c5 = toNullableString(cells[5])?.toLowerCase();
  return c0 === 'uuid' && (c5 === 'line_number' || cells.length >= 300);
}

export interface ParsedHouseholdPayload {
  cbms_uuid: string;
  map_uuid: string | null;
  city_mun_geo_code: string;
  barangay_geo_code: string;
  city_mun_name: string;
  barangay_name: string;
  region_code: string;
  province_code: string;
  city_mun_code: string;
  barangay_code: string;
  husn: string | null;
  hsn: string | null;
  longitude: number | null;
  latitude: number | null;
  hh_size: number | null;
  number_of_males: number | null;
  number_of_females: number | null;
  number_of_nuclear_families: number | null;
  respondent_line_number: string | null;
  agree_to_sign_the_waiver: number | null;
  reason_for_not_signing_the_waiver: number | null;
  address_house_number: string | null;
  address_floor_number: string | null;
  address_block_or_lot_number: string | null;
  address_street_name: string | null;
  address_subdivision_or_village: string | null;
  address_sitio_purok: string | null;
  proximity_health_center: number | null;
  proximity_hospital: number | null;
  overcrowding_status: number | null;
  sections: {
    household_health: Record<string, unknown>;
    household_food_security: Record<string, unknown>;
    household_connectivity_safety: Record<string, unknown>;
    household_financial_accounts: Record<string, unknown>;
    household_disaster_shocks: Record<string, unknown>;
    household_social_protection: Record<string, unknown>;
    household_wash: Record<string, unknown>;
    household_housing: Record<string, unknown>;
    household_assets: Record<string, unknown>;
    household_poverty: Record<string, unknown>;
  };
}

export interface ParsedMemberPayload {
  cbms_uuid: string;
  line_number: string;
  city_mun_geo_code_x: string | null;
  barangay_geo_code_x: string | null;
  city_mun_x: string | null;
  barangay_x: string | null;
  husn_x: string | null;
  hsn_x: string | null;
  sections: {
    member_demographics_core: Record<string, unknown>;
    member_demographics_other: Record<string, unknown>;
    member_migration: Record<string, unknown>;
    member_education: Record<string, unknown>;
    member_economics: Record<string, unknown>;
  };
}

export interface ParsedCbmsRowResult {
  household: ParsedHouseholdPayload | null;
  member: ParsedMemberPayload | null;
  warnings: EtlValidationWarning[];
}

function extractDomainColumns(
  cols: readonly string[],
  cells: unknown[],
  headerMap: Map<string, number>,
  defaultZeroForMissing = false,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const col of cols) {
    const idx = headerMap.get(col);
    const raw = idx !== undefined ? cells[idx] : undefined;
    if (STRING_DOMAIN_COLS.has(col)) {
      record[col] = toNullableString(raw, 100);
    } else if (INT32_DOMAIN_COLS.has(col)) {
      record[col] = toNullableInt(raw);
    } else if (FLOAT_DOMAIN_COLS.has(col)) {
      record[col] = toNullableFloat(raw);
    } else {
      record[col] = toNullableSmallInt(raw, defaultZeroForMissing ? 0 : null);
    }
  }
  return record;
}

/**
 * Parses a single 0-indexed 312-column CBMS row into normalized Household + Member payloads.
 * Pass `includeHousehold = false` if this household's `cbms_uuid` was already parsed in the current batch.
 */
export function parseCbms312Row(
  cells: unknown[],
  headerMap: Map<string, number>,
  rowNumber: number,
  includeHousehold = true,
): ParsedCbmsRowResult {
  const warnings: EtlValidationWarning[] = [];

  const getCell = (colName: string, fallbackIdx: number): unknown => {
    const idx = headerMap.get(colName) ?? fallbackIdx;
    return cells[idx];
  };

  const cbmsUuid = toNullableUuid(getCell('uuid', 0));
  if (!cbmsUuid) {
    warnings.push({
      rowNumber,
      code: 'INVALID_UUID',
      message: `Row ${rowNumber}: Missing or invalid household UUID in column 0.`,
    });
    return { household: null, member: null, warnings };
  }

  const rawLineNo = toNullableString(getCell('line_number', 5), 10) ?? '01';
  const lineNumber = rawLineNo.padStart(2, '0');

  const cityMunGeoX = toNullableString(getCell('city_mun_geo_code.x', 1), 15);
  const brgyGeoX = toNullableString(getCell('barangay_geo_code.x', 2), 20);
  const cityMunNameX = toNullableString(getCell('city_mun.x', 3), 150);
  const brgyNameX = toNullableString(getCell('barangay.x', 4), 150);
  const husnX = toNullableString(getCell('husn.x', 10), 20);
  const hsnX = toNullableString(getCell('hsn.x', 11), 20);

  const member: ParsedMemberPayload = {
    cbms_uuid: cbmsUuid,
    line_number: lineNumber,
    city_mun_geo_code_x: cityMunGeoX,
    barangay_geo_code_x: brgyGeoX,
    city_mun_x: cityMunNameX,
    barangay_x: brgyNameX,
    husn_x: husnX,
    hsn_x: hsnX,
    sections: {
      member_demographics_core: extractDomainColumns(MEMBER_DEMO_CORE_COLS, cells, headerMap),
      member_demographics_other: extractDomainColumns(MEMBER_DEMO_OTHER_COLS, cells, headerMap),
      member_migration: extractDomainColumns(MEMBER_MIGRATION_COLS, cells, headerMap),
      member_education: extractDomainColumns(MEMBER_EDUCATION_COLS, cells, headerMap),
      member_economics: extractDomainColumns(MEMBER_ECONOMICS_COLS, cells, headerMap),
    },
  };

  if (!includeHousehold) {
    return { household: null, member, warnings };
  }

  const cityMunGeoY =
    toNullableString(getCell('city_mun_geo_code.y', 108), 15) ?? cityMunGeoX ?? '1608506';
  const brgyGeoY =
    toNullableString(getCell('barangay_geo_code.y', 109), 20) ?? brgyGeoX ?? '1608506001';
  const cityMunNameY =
    toNullableString(getCell('city_mun.y', 110), 150) ??
    cityMunNameX ??
    'San Jose, Dinagat Islands';
  const brgyNameY =
    toNullableString(getCell('barangay.y', 111), 150) ?? brgyNameX ?? 'Unknown Barangay';

  const regionCode =
    toNullableString(getCell('region_code', 6), 10) ?? cityMunGeoY.slice(0, 2) ?? '16';
  const provinceCode =
    toNullableString(getCell('province_code', 7), 10) ?? cityMunGeoY.slice(2, 5) ?? '085';
  const cityMunCode =
    toNullableString(getCell('city_mun_code', 8), 10) ?? cityMunGeoY.slice(5, 7) ?? '06';
  const barangayCode =
    toNullableString(getCell('barangay_code', 9), 10) ?? brgyGeoY.slice(-3) ?? '001';

  let rawLng = toNullableFloat(getCell('longitude', 115));
  let rawLat = toNullableFloat(getCell('latitude', 116));

  // Detect swapped lat/lng or out-of-Philippine-bounds coordinates (Guardrail 4.1 & 4.2)
  if (rawLng !== null && rawLat !== null) {
    if (rawLng >= 4.0 && rawLng <= 21.5 && rawLat >= 116.0 && rawLat <= 127.0) {
      const tmp = rawLng;
      rawLng = rawLat;
      rawLat = tmp;
      warnings.push({
        rowNumber,
        cbmsUuid,
        code: 'SWAPPED_LAT_LNG_AUTO_FIXED',
        message: `Row ${rowNumber}: Swapped (lat, lng) coordinates automatically corrected to [${rawLng}, ${rawLat}].`,
      });
    } else if (rawLng < 116.0 || rawLng > 127.0 || rawLat < 4.0 || rawLat > 21.5) {
      warnings.push({
        rowNumber,
        cbmsUuid,
        code: 'COORDS_OUT_OF_PH_BOUNDS',
        message: `Row ${rowNumber}: Coordinates [${rawLng}, ${rawLat}] outside valid Philippine bounds (116–127°E, 4–21.5°N); geometry nulled.`,
      });
      rawLng = null;
      rawLat = null;
    }
  } else {
    rawLng = null;
    rawLat = null;
  }

  const household: ParsedHouseholdPayload = {
    cbms_uuid: cbmsUuid,
    map_uuid: toNullableUuid(getCell('map_uuid', 112)),
    city_mun_geo_code: cityMunGeoY,
    barangay_geo_code: brgyGeoY,
    city_mun_name: cityMunNameY,
    barangay_name: brgyNameY,
    region_code: regionCode,
    province_code: provinceCode,
    city_mun_code: cityMunCode,
    barangay_code: barangayCode,
    husn: toNullableString(getCell('husn.y', 113), 20) ?? husnX,
    hsn: toNullableString(getCell('hsn.y', 114), 20) ?? hsnX,
    longitude: rawLng,
    latitude: rawLat,
    hh_size: toNullableSmallInt(getCell('hh_size', 117)),
    number_of_males: toNullableSmallInt(getCell('number_of_males', 118)),
    number_of_females: toNullableSmallInt(getCell('number_of_females', 119)),
    number_of_nuclear_families: toNullableSmallInt(getCell('number_of_nuclear_families', 120)),
    respondent_line_number: toNullableString(getCell('respondent_line_number', 121), 10),
    agree_to_sign_the_waiver: toNullableSmallInt(getCell('agree_to_sign_the_waiver', 122)),
    reason_for_not_signing_the_waiver: toNullableSmallInt(
      getCell('reason_for_not_signing_the_waiver', 123),
    ),
    address_house_number: toNullableString(getCell('address_house_number', 124), 100),
    address_floor_number: toNullableString(getCell('address_floor_number', 125), 50),
    address_block_or_lot_number: toNullableString(
      getCell('address_block_or_lot_number', 126),
      100,
    ),
    address_street_name: toNullableString(getCell('address_street_name', 127), 150),
    address_subdivision_or_village: toNullableString(
      getCell('address_subdivision_or_village', 128),
      150,
    ),
    address_sitio_purok: toNullableString(getCell('address_sitio_purok', 129), 150),
    proximity_health_center: toNullableFloat(getCell('proximity_health_center', 130)),
    proximity_hospital: toNullableFloat(getCell('proximity_hospital', 131)),
    overcrowding_status: toNullableSmallInt(getCell('overcrowding_status', 132)),
    sections: {
      household_health: extractDomainColumns(HOUSEHOLD_HEALTH_COLS, cells, headerMap),
      household_food_security: extractDomainColumns(
        HOUSEHOLD_FOOD_SECURITY_COLS,
        cells,
        headerMap,
      ),
      household_connectivity_safety: extractDomainColumns(
        HOUSEHOLD_CONNECTIVITY_SAFETY_COLS,
        cells,
        headerMap,
      ),
      household_financial_accounts: extractDomainColumns(
        HOUSEHOLD_FINANCIAL_ACCOUNTS_COLS,
        cells,
        headerMap,
      ),
      household_disaster_shocks: extractDomainColumns(
        HOUSEHOLD_DISASTER_SHOCKS_COLS,
        cells,
        headerMap,
      ),
      household_social_protection: extractDomainColumns(
        HOUSEHOLD_SOCIAL_PROTECTION_COLS,
        cells,
        headerMap,
      ),
      household_wash: extractDomainColumns(HOUSEHOLD_WASH_COLS, cells, headerMap),
      household_housing: extractDomainColumns(HOUSEHOLD_HOUSING_COLS, cells, headerMap),
      household_assets: extractDomainColumns(HOUSEHOLD_ASSETS_COLS, cells, headerMap, true),
      household_poverty: extractDomainColumns(HOUSEHOLD_POVERTY_COLS, cells, headerMap),
    },
  };

  return { household, member, warnings };
}
