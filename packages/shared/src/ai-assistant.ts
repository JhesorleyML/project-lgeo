import { z } from 'zod';
import type {
  CbmsSectionCode,
  HeadlineChoroplethMetricId,
  ReportIndicatorId,
  VulnerabilityCriterionId,
} from './cbms-dictionary.js';
import type { LandmarkSectorId, PortalPageId } from './api-types.js';

/**
 * Columns strictly forbidden from EVER being queried, selected, or exposed to the AI Chatbot
 * under RA 10173 (Data Privacy Act of 2012) and RA 11315 (CBMS Act Section 10 Confidentiality).
 * Even ADMIN users cannot query individual names or exact household identifiers via the AI model.
 */
export const AI_FORBIDDEN_PII_COLUMNS = [
  // Section A: Individual Member Names & Exact Birthdays (Columns 12-15, 18-19)
  'a01_last_name',
  'a01_first_name',
  'a01_middle_name',
  'a01_suffix',
  'a04_birthday_month',
  'a04_birthday_day',
  // Core Household & Member Identifiers / Serials (Columns 0, 10-11, 112-114)
  'cbms_uuid',
  'map_uuid',
  'husn',
  'hsn',
  'husn_x',
  'hsn_x',
  'respondent_line_number',
  // Exact Household Street Address & Raw Point Coordinates (Columns 115-116, 124-128)
  'address_house_number',
  'address_floor_number',
  'address_block_or_lot_number',
  'address_street_name',
  'address_subdivision_or_village',
  'longitude',
  'latitude',
  'geom_point',
  // Derived Roster PII Fields
  'head_name',
  'headName',
  'firstName',
  'lastName',
  'middleName',
  'houseNumber',
] as const;

export type AiForbiddenPiiColumn = (typeof AI_FORBIDDEN_PII_COLUMNS)[number];

export const AI_FORBIDDEN_PII_SET: ReadonlySet<string> = new Set(
  AI_FORBIDDEN_PII_COLUMNS.map((c) => c.toLowerCase()),
);

export interface AiWhitelistedColumnMeta {
  columnName: string;
  tableName: string;
  sectionCode: CbmsSectionCode;
  level: 'MEMBER' | 'HOUSEHOLD';
  columnNumber: number;
  label: string;
  description: string;
  valueCodebook: Readonly<Record<string, string>>;
}

/**
 * Curated Whitelist of Non-PII Analytical CBMS Columns across Sections A-O + Poverty
 * for dynamic frequency distribution & statistical aggregation by the AI Chatbot.
 */
export const AI_WHITELISTED_COLUMNS: readonly AiWhitelistedColumnMeta[] = [
  // Section A: Core Demographics (Non-PII statistical attributes only)
  {
    columnName: 'a03_sex',
    tableName: 'member_demographics_core',
    sectionCode: 'A',
    level: 'MEMBER',
    columnNumber: 17,
    label: 'Sex of Household Member (A03)',
    description: 'Biological sex distribution of household members.',
    valueCodebook: { '1': 'Male', '2': 'Female' },
  },
  {
    columnName: 'a05_age_group_five_years',
    tableName: 'member_demographics_core',
    sectionCode: 'A',
    level: 'MEMBER',
    columnNumber: 22,
    label: '5-Year Age Cohort Group (A05)',
    description: 'Standard 5-year demographic age group classification.',
    valueCodebook: {
      '1': '0-4 years',
      '2': '5-9 years',
      '3': '10-14 years',
      '4': '15-19 years',
      '5': '20-24 years',
      '13': '60+ Senior Citizens',
    },
  },
  {
    columnName: 'a06_lcr_reg_status',
    tableName: 'member_demographics_core',
    sectionCode: 'A',
    level: 'MEMBER',
    columnNumber: 23,
    label: 'Birth Registration Status with Local Civil Registrar (A06)',
    description: 'Whether member birth is registered with the Local Civil Registrar (LCR).',
    valueCodebook: { '1': 'Registered (Yes)', '2': 'Not Registered (No)', '8': 'Don’t Know' },
  },
  {
    columnName: 'a07_marital_status',
    tableName: 'member_demographics_core',
    sectionCode: 'A',
    level: 'MEMBER',
    columnNumber: 24,
    label: 'Marital / Civil Status (A07)',
    description: 'Civil status of household members.',
    valueCodebook: {
      '1': 'Single / Never Married',
      '2': 'Married',
      '3': 'Common-Law / Live-In',
      '4': 'Widowed',
      '5': 'Divorced / Separated',
    },
  },
  {
    columnName: 'a10_simple_literacy',
    tableName: 'member_demographics_core',
    sectionCode: 'A',
    level: 'MEMBER',
    columnNumber: 27,
    label: 'Simple Literacy (Age 10+, A10)',
    description: 'Ability to read and write a simple message in any language or dialect.',
    valueCodebook: { '1': 'Literate (Yes)', '2': 'Non-Literate (No)' },
  },
  {
    columnName: 'a11_hgc_level',
    tableName: 'member_demographics_core',
    sectionCode: 'A',
    level: 'MEMBER',
    columnNumber: 28,
    label: 'Highest Grade Completed Level (A11)',
    description: 'Highest educational attainment level completed by member.',
    valueCodebook: {
      '0': 'No Grade Completed',
      '1': 'Early Childhood / Preschool',
      '2': 'Elementary',
      '3': 'Junior High School',
      '4': 'Senior High School',
      '5': 'Post-Secondary / TVET',
      '6': 'College / Baccalaureate',
      '7': 'Postgraduate',
    },
  },

  // Section B: Other Demographics (PWD, Senior, Solo Parent, PhilSys)
  {
    columnName: 'b03_phil_id',
    tableName: 'member_demographics_other',
    sectionCode: 'B',
    level: 'MEMBER',
    columnNumber: 33,
    label: 'PhilSys National ID Registration (B03)',
    description: 'Possession or registration in the Philippine Identification System.',
    valueCodebook: { '1': 'With PhilSys ID (Yes)', '2': 'Without PhilSys ID (No)', '8': 'Don’t Know' },
  },
  {
    columnName: 'b05_solo_parent',
    tableName: 'member_demographics_other',
    sectionCode: 'B',
    level: 'MEMBER',
    columnNumber: 34,
    label: 'Solo Parent Status (B05)',
    description: 'Solo parent classification under RA 8972 / RA 11861.',
    valueCodebook: { '1': 'Solo Parent (Yes)', '2': 'Not Solo Parent (No)' },
  },
  {
    columnName: 'b07_senior_citizen_id',
    tableName: 'member_demographics_other',
    sectionCode: 'B',
    level: 'MEMBER',
    columnNumber: 36,
    label: 'Senior Citizen ID Possession (B07)',
    description: 'Whether senior citizen member aged 60+ possesses an OSCA Senior Citizen ID.',
    valueCodebook: { '1': 'With Senior Citizen ID', '2': 'Without Senior Citizen ID' },
  },
  {
    columnName: 'b10_pwd',
    tableName: 'member_demographics_other',
    sectionCode: 'B',
    level: 'MEMBER',
    columnNumber: 39,
    label: 'Person with Disability (PWD) Status (B10)',
    description: 'Whether member has any functional or diagnosed disability.',
    valueCodebook: { '1': 'With Disability (PWD)', '2': 'No Disability' },
  },

  // Section C: Migration & OFW
  {
    columnName: 'c02_ofi',
    tableName: 'member_migration',
    sectionCode: 'C',
    level: 'MEMBER',
    columnNumber: 59,
    label: 'Overseas Filipino Indicator (C02)',
    description: 'Classification of overseas workers (OFW with contract, without contract, overseas resident).',
    valueCodebook: {
      '1': 'OFW with Contract',
      '2': 'OFW without Contract',
      '3': 'Embassy / Consular Staff Abroad',
      '4': 'Student / Tourist / Emigrant Abroad',
      '6': 'Resident in the Philippines',
    },
  },
  {
    columnName: 'c06_internal_displacement',
    tableName: 'member_migration',
    sectionCode: 'C',
    level: 'MEMBER',
    columnNumber: 69,
    label: 'Reason for Internal Displacement (C06)',
    description: 'Whether member was displaced by natural calamities, armed conflict, or infrastructure.',
    valueCodebook: {
      '1': 'Not Displaced',
      '2': 'Displaced by Natural Calamity / Typhoon',
      '3': 'Human-Induced / Conflict Displacement',
    },
  },

  // Section D: Education & TVET
  {
    columnName: 'd01_currently_attending_school',
    tableName: 'member_education',
    sectionCode: 'D',
    level: 'MEMBER',
    columnNumber: 70,
    label: 'Current School Attendance (D01)',
    description: 'Whether member is currently attending school.',
    valueCodebook: { '1': 'Currently Attending School', '2': 'Not Attending School' },
  },
  {
    columnName: 'd02_type_of_school_attended',
    tableName: 'member_education',
    sectionCode: 'D',
    level: 'MEMBER',
    columnNumber: 71,
    label: 'Type of School Attended (D02)',
    description: 'Public vs Private school enrollment.',
    valueCodebook: { '1': 'Public School', '2': 'Private School' },
  },
  {
    columnName: 'd07_tvet_graduate',
    tableName: 'member_education',
    sectionCode: 'D',
    level: 'MEMBER',
    columnNumber: 82,
    label: 'TVET / TESDA Graduate Status (D07)',
    description: 'Completion of Technical-Vocational Education and Training course.',
    valueCodebook: { '1': 'TVET Graduate (Yes)', '2': 'Non-Graduate (No)' },
  },

  // Section E: Economic Characteristics & Livelihood
  {
    columnName: 'e01_employment_status',
    tableName: 'member_economics',
    sectionCode: 'E',
    level: 'MEMBER',
    columnNumber: 85,
    label: 'Employment Status (E01)',
    description: 'Labor force employment classification.',
    valueCodebook: { '1': 'Employed', '2': 'Unemployed', '3': 'Not in Labor Force' },
  },
  {
    columnName: 'e17_farmer',
    tableName: 'member_economics',
    sectionCode: 'E',
    level: 'MEMBER',
    columnNumber: 106,
    label: 'Agricultural Farmer Indicator (E17)',
    description: 'Engagement in crop farming or agricultural livelihood.',
    valueCodebook: { '1': 'Farmer (Yes)', '2': 'Non-Farmer (No)' },
  },
  {
    columnName: 'e18_fisherfolk',
    tableName: 'member_economics',
    sectionCode: 'E',
    level: 'MEMBER',
    columnNumber: 107,
    label: 'Fisherfolk / Coastal Fishing Livelihood (E18)',
    description: 'Engagement in municipal or coastal capture fishing / aquaculture.',
    valueCodebook: { '1': 'Fisherfolk (Yes)', '2': 'Non-Fisherfolk (No)' },
  },

  // Section F: Health & Nutrition
  {
    columnName: 'f01_with_member_who_has_been_sick',
    tableName: 'household_health',
    sectionCode: 'F',
    level: 'HOUSEHOLD',
    columnNumber: 133,
    label: 'Household Member Illness in Past 12 Months (F01)',
    description: 'Whether any household member experienced illness or injury in the past year.',
    valueCodebook: { '1': 'Had Sick Member (Yes)', '2': 'None (No)' },
  },
  {
    columnName: 'f02_availed_medical_treatment',
    tableName: 'household_health',
    sectionCode: 'F',
    level: 'HOUSEHOLD',
    columnNumber: 134,
    label: 'Availed Medical Treatment (F02)',
    description: 'Whether the sick household member received medical consultation/treatment.',
    valueCodebook: { '1': 'Availed Treatment (Yes)', '2': 'Did Not Avail Treatment (No)' },
  },

  // Section G: Food Security (FIES)
  {
    columnName: 'g04_skipped_meal',
    tableName: 'household_food_security',
    sectionCode: 'G',
    level: 'HOUSEHOLD',
    columnNumber: 163,
    label: 'Skipped a Meal Due to Lack of Money/Food (G04)',
    description: 'FIES indicator for skipping meals due to lack of resources.',
    valueCodebook: { '1': 'Experienced Skipping Meals (Yes)', '2': 'No' },
  },
  {
    columnName: 'g07_hungry',
    tableName: 'household_food_security',
    sectionCode: 'G',
    level: 'HOUSEHOLD',
    columnNumber: 166,
    label: 'Went Hungry Because There Was Not Enough Food (G07)',
    description: 'Severe food insecurity indicator (experienced hunger).',
    valueCodebook: { '1': 'Experienced Hunger (Yes)', '2': 'No' },
  },

  // Section I: Financial Inclusion
  {
    columnName: 'i01_a_bank_account',
    tableName: 'household_financial_accounts',
    sectionCode: 'I',
    level: 'HOUSEHOLD',
    columnNumber: 169,
    label: 'Formal Bank Account Ownership (I01A)',
    description: 'Whether household owns a formal commercial/rural bank account.',
    valueCodebook: { '1': 'With Bank Account (Yes)', '2': 'Without Bank Account (No)' },
  },
  {
    columnName: 'i01_c_emoney_or_cash_card',
    tableName: 'household_financial_accounts',
    sectionCode: 'I',
    level: 'HOUSEHOLD',
    columnNumber: 171,
    label: 'E-Money / GCash / Maya / Cash Card Ownership (I01C)',
    description: 'Ownership of digital wallet or e-money account.',
    valueCodebook: { '1': 'With E-Money Account (Yes)', '2': 'Without E-Money Account (No)' },
  },

  // Section J: Disaster Shocks & DRRM
  {
    columnName: 'j01_a_typhoon',
    tableName: 'household_disaster_shocks',
    sectionCode: 'J',
    level: 'HOUSEHOLD',
    columnNumber: 177,
    label: 'Impacted by Typhoon / Strong Winds (J01A)',
    description: 'Households affected by severe tropical cyclones in the past 12 months.',
    valueCodebook: { '1': 'Affected by Typhoon (Yes)', '2': 'Not Affected (No)' },
  },
  {
    columnName: 'j01_d_rain_or_flood',
    tableName: 'household_disaster_shocks',
    sectionCode: 'J',
    level: 'HOUSEHOLD',
    columnNumber: 180,
    label: 'Impacted by Heavy Rain or Flooding (J01D)',
    description: 'Households affected by coastal or flash flooding.',
    valueCodebook: { '1': 'Affected by Flood (Yes)', '2': 'Not Affected (No)' },
  },
  {
    columnName: 'j02_location_of_evacuation',
    tableName: 'household_disaster_shocks',
    sectionCode: 'J',
    level: 'HOUSEHOLD',
    columnNumber: 198,
    label: 'Awareness of Barangay Evacuation Center Location (J02)',
    description: 'Whether the household knows the designated evacuation center in their barangay.',
    valueCodebook: { '1': 'Aware of Evacuation Center (Yes)', '2': 'Unaware (No)' },
  },

  // Sections H, K, L: Connectivity, Transport & Public Safety
  {
    columnName: 'h01_puv_access',
    tableName: 'household_connectivity_safety',
    sectionCode: 'H_K_L',
    level: 'HOUSEHOLD',
    columnNumber: 168,
    label: 'Access to Public Transport (PUV Stop Within 500m, H01)',
    description: 'Whether household can reach a PUV stop within 500 meters / 10-15 min walk.',
    valueCodebook: { '1': 'Accessible Within 500m (Yes)', '2': 'Not Accessible (No)' },
  },
  {
    columnName: 'k02_internet_at_home',
    tableName: 'household_connectivity_safety',
    sectionCode: 'H_K_L',
    level: 'HOUSEHOLD',
    columnNumber: 201,
    label: 'Home Internet Connection (K02)',
    description: 'Whether household has active internet connection at home.',
    valueCodebook: { '1': 'With Home Internet (Yes)', '2': 'Without Home Internet (No)' },
  },
  {
    columnName: 'l01_safe_walking_alone',
    tableName: 'household_connectivity_safety',
    sectionCode: 'H_K_L',
    level: 'HOUSEHOLD',
    columnNumber: 206,
    label: 'Perception of Public Safety Walking Alone at Night (L01)',
    description: 'Feeling of safety when walking alone in the neighborhood at night.',
    valueCodebook: {
      '1': 'Very Safe',
      '2': 'Safe',
      '3': 'Unsafe',
      '4': 'Very Unsafe',
    },
  },

  // Section M: Social Protection & 4Ps
  {
    columnName: 'm01_c_philhealth',
    tableName: 'household_social_protection',
    sectionCode: 'M',
    level: 'HOUSEHOLD',
    columnNumber: 209,
    label: 'PhilHealth Membership Coverage (M01C)',
    description: 'Household enrollment in PhilHealth national health insurance.',
    valueCodebook: { '1': 'Covered by PhilHealth (Yes)', '2': 'Not Covered (No)' },
  },
  {
    columnName: 'm05_a_4ps',
    tableName: 'household_social_protection',
    sectionCode: 'M',
    level: 'HOUSEHOLD',
    columnNumber: 217,
    label: 'Pantawid Pamilyang Pilipino Program (4Ps) Enrollment (M05A)',
    description: 'Active beneficiary status in DSWD 4Ps conditional cash transfer program.',
    valueCodebook: { '1': '4Ps Beneficiary (Yes)', '2': 'Non-4Ps (No)' },
  },
  {
    columnName: 'm05_b_socpen',
    tableName: 'household_social_protection',
    sectionCode: 'M',
    level: 'HOUSEHOLD',
    columnNumber: 218,
    label: 'Social Pension for Indigent Senior Citizens (M05B)',
    description: 'Receipt of DSWD Social Pension (SocPen).',
    valueCodebook: { '1': 'SocPen Beneficiary (Yes)', '2': 'Non-Beneficiary (No)' },
  },

  // Section N: Water, Sanitation & Hygiene (WASH)
  {
    columnName: 'n03_service_level_drinking_water',
    tableName: 'household_wash',
    sectionCode: 'N',
    level: 'HOUSEHOLD',
    columnNumber: 235,
    label: 'Drinking Water Service Level (N03)',
    description: 'JMP/PSA drinking water service ladder classification.',
    valueCodebook: {
      '1': 'Safely Managed / Basic (Level III / Improved)',
      '2': 'Limited Service (Level I / II >30 mins)',
      '3': 'Unimproved Water Source',
      '4': 'Surface Water (Untreated)',
    },
  },
  {
    columnName: 'n08_service_level_toilet_facility',
    tableName: 'household_wash',
    sectionCode: 'N',
    level: 'HOUSEHOLD',
    columnNumber: 243,
    label: 'Sanitation / Toilet Facility Service Level (N08)',
    description: 'Sanitation ladder level of household toilet facility.',
    valueCodebook: {
      '1': 'Basic / Safely Managed Sanitary Toilet (Exclusive)',
      '2': 'Limited Service (Shared Improved Toilet)',
      '3': 'Unimproved Toilet Facility',
      '4': 'Open Defecation / No Toilet Facility',
    },
  },

  // Section O: Housing, Utilities & Household Assets
  {
    columnName: 'o03_roof',
    tableName: 'household_housing',
    sectionCode: 'O_HOUSING',
    level: 'HOUSEHOLD',
    columnNumber: 267,
    label: 'Construction Material of Roof (O03)',
    description: 'Primary roof material of the housing unit.',
    valueCodebook: {
      '1': 'Strong Material (Galvanized Iron / Aluminum / Concrete)',
      '2': 'Mixed Predominantly Strong',
      '3': 'Light Material (Nipa / Cogon / Anahaw / Bamboo)',
      '4': 'Salvaged / Makeshift Materials',
    },
  },
  {
    columnName: 'o04_outer_walls',
    tableName: 'household_housing',
    sectionCode: 'O_HOUSING',
    level: 'HOUSEHOLD',
    columnNumber: 269,
    label: 'Construction Material of Outer Walls (O04)',
    description: 'Primary outer wall material of the housing unit.',
    valueCodebook: {
      '1': 'Strong Material (Concrete / Brick / Stone / Wood)',
      '2': 'Mixed Predominantly Strong',
      '3': 'Light Material (Bamboo / Sawali / Cogon / Nipa)',
      '4': 'Salvaged / Makeshift Materials',
    },
  },
  {
    columnName: 'o09_tenure',
    tableName: 'household_housing',
    sectionCode: 'O_HOUSING',
    level: 'HOUSEHOLD',
    columnNumber: 277,
    label: 'Tenure Status of Housing Unit and Lot (O09)',
    description: 'Ownership or occupancy tenure status of house and lot.',
    valueCodebook: {
      '1': 'Own or Owner-Like Possession of House and Lot',
      '2': 'Rent House / Room Including Lot',
      '3': 'Own House, Rent-Free Lot WITH Consent of Owner',
      '5': 'Informal Settler (Rent-Free Lot WITHOUT Consent of Owner)',
    },
  },
  {
    columnName: 'o11_electricity',
    tableName: 'household_housing',
    sectionCode: 'O_HOUSING',
    level: 'HOUSEHOLD',
    columnNumber: 280,
    label: 'Electricity Connection in Dwelling (O11)',
    description: 'Presence of electrical power connection in the housing unit.',
    valueCodebook: { '1': 'With Electricity (Yes)', '2': 'Without Electricity (No)' },
  },
  {
    columnName: 'o14_v_banca_motorized',
    tableName: 'household_assets',
    sectionCode: 'O_ASSETS',
    level: 'HOUSEHOLD',
    columnNumber: 304,
    label: 'Motorized Banca / Fishing Boat Ownership (O14V)',
    description: 'Ownership of motorized marine banca/boat for fishing or island transport.',
    valueCodebook: { '0': 'None (0)', '1': 'Owns 1+ Motorized Banca' },
  },

  // Section Poverty: Official Thresholds
  {
    columnName: 'poor',
    tableName: 'household_poverty',
    sectionCode: 'POVERTY',
    level: 'HOUSEHOLD',
    columnNumber: 306,
    label: 'Poverty Classification (Official CBMS Poverty Threshold)',
    description: 'Binary poverty status (1 = Poor, 0 = Non-Poor).',
    valueCodebook: { '1': 'Poor (Below Poverty Threshold)', '0': 'Non-Poor' },
  },
  {
    columnName: 'near_poor_5_pct',
    tableName: 'household_poverty',
    sectionCode: 'POVERTY',
    level: 'HOUSEHOLD',
    columnNumber: 307,
    label: 'Near-Poor (+5% Vulnerability Buffer)',
    description: 'Households within +5% above the official poverty line.',
    valueCodebook: { '1': 'Near-Poor (+5%)', '0': 'Above +5% Buffer' },
  },
] as const;

export const AI_WHITELISTED_COLUMN_MAP: ReadonlyMap<string, AiWhitelistedColumnMeta> = new Map(
  AI_WHITELISTED_COLUMNS.map((c) => [c.columnName.toLowerCase(), c]),
);

/**
 * Interactive Web-GIS Map Action emitted by the AI Chatbot so users can apply
 * spatial findings directly onto the MapLibre canvas without storing GeoJSON in Zustand.
 */
export const AiMapActionSchema = z.object({
  label: z.string(),
  targetPage: z.enum(['map', 'dashboard', 'reports', 'yoy'] as const).default('map'),
  surveyYear: z.number().int().optional(),
  choroplethMetric: z
    .enum([
      'poor_rate',
      'near_poor_5_rate',
      'near_poor_10_rate',
      'near_poor_15_rate',
      'near_poor_20_rate',
      'near_poor_25_rate',
      'electricity_rate',
      'internet_rate',
      'beneficiary_4ps_rate',
    ] as const)
    .optional(),
  vulnerabilityCriteria: z
    .array(
      z.enum([
        'poor',
        'near_poor_5',
        'senior_citizen',
        'pwd',
        'solo_parent',
        'food_insecure',
        'no_electricity',
        'no_internet',
        'no_4ps_poor',
        'unimproved_water',
        'makeshift_housing',
        'disaster_shock',
      ] as const),
    )
    .optional(),
  landmarkSector: z
    .enum([
      'ALL',
      'HEALTH_WELFARE',
      'DRRM_EVACUATION',
      'EDUCATION',
      'GOVERNANCE',
      'TRANSPORT_LIFELINES',
      'COMMERCE_ENVIRONMENT',
    ] as const)
    .optional(),
  catchmentLandmarkId: z.number().int().optional(),
  catchmentRadiusMeters: z.number().int().optional(),
  enableLandUse: z.boolean().optional(),
  enableRoads: z.boolean().optional(),
});

export type AiMapAction = z.infer<typeof AiMapActionSchema>;

export const AiToolCallTraceSchema = z.object({
  toolName: z.enum([
    'getBarangaySummaryStats',
    'queryMultiDimensionIndicators',
    'aggregateWhitelistedCbmsColumn',
    'compareYearOverYearStats',
    'querySpatialFacilityCatchment',
    'searchCbmsDictionaryAndMetadata',
    'privacyGuardrailRefusal',
  ]),
  summary: z.string(),
  tablesQueried: z.array(z.string()),
  spatialOrDbIndexesUsed: z.array(z.string()),
  executionTimeMs: z.number(),
  zeroPiiVerified: z.literal(true),
});

export type AiToolCallTrace = z.infer<typeof AiToolCallTraceSchema>;

export const AiChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(16000),
  timestamp: z.string().optional(),
});

export type AiChatMessage = z.infer<typeof AiChatMessageSchema>;

export const AiChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(AiChatMessageSchema).max(20).optional().default([]),
  surveyYear: z.coerce.number().int().min(2000).max(2100).default(2024),
  activeBarangayGeoCode: z.string().trim().optional().default('ALL'),
  activePage: z
    .enum(['dashboard', 'map', 'uploads', 'reports', 'yoy', 'users'] as const)
    .optional()
    .default('dashboard'),
});

export type AiChatRequest = z.infer<typeof AiChatRequestSchema>;

export interface AiChatResponse {
  reply: string;
  providerUsed: 'builtin' | 'gemini' | 'openai' | 'ollama';
  privacyStatus: 'CLEARED_AGGREGATE_ONLY' | 'BLOCKED_PII_REQUEST';
  surveyYear: number;
  toolTraces: AiToolCallTrace[];
  mapActions: AiMapAction[];
  suggestedFollowUps: string[];
}

export interface AiSuggestionPrompt {
  id: string;
  category:
    | 'POVERTY_RANKING'
    | 'MULTI_DIMENSION'
    | 'YOY_TRENDS'
    | 'SPATIAL_CATCHMENT'
    | 'WASH_HOUSING'
    | 'CBMS_DICTIONARY';
  title: string;
  prompt: string;
  badge: string;
}

export const CBMS_AI_STARTER_PROMPTS: readonly AiSuggestionPrompt[] = [
  {
    id: 'poverty-ranking',
    category: 'POVERTY_RANKING',
    title: 'Barangay Poverty & 4Ps Gap Ranking',
    prompt: 'Which barangays have the highest poverty incidence and 4Ps undercoverage gap in 2024?',
    badge: 'Sections M & Poverty',
  },
  {
    id: 'vulnerable-cross-tab',
    category: 'MULTI_DIMENSION',
    title: 'Senior Citizens, PWDs & Food Insecurity',
    prompt: 'How many households have senior citizens or PWDs and experience food insecurity across all barangays?',
    badge: 'Sections A, B & G',
  },
  {
    id: 'wash-housing',
    category: 'WASH_HOUSING',
    title: 'WASH, Makeshift Housing & Off-Grid Gaps',
    prompt: 'Show the breakdown of unimproved drinking water, makeshift housing, and households without electricity.',
    badge: 'Sections N & O',
  },
  {
    id: 'yoy-comparison',
    category: 'YOY_TRENDS',
    title: '2022 vs 2024 Longitudinal Comparison',
    prompt: 'Compare 2022 vs 2024 poverty incidence, electricity, and home internet rates across barangays.',
    badge: 'Multi-Year YoY',
  },
  {
    id: 'spatial-drrm',
    category: 'SPATIAL_CATCHMENT',
    title: 'Spatial Facility Catchment & DRRM Exposure',
    prompt: 'How many households are affected by typhoon/flood disaster shocks and how many are within 500m of evacuation centers?',
    badge: 'PostGIS ST_DWithin',
  },
  {
    id: 'dictionary-rag',
    category: 'CBMS_DICTIONARY',
    title: 'CBMS 312-Column Dictionary & RA 10173 Rules',
    prompt: 'How does CBMS measure Near-Poor thresholds (+5% to +25%) and why are individual member names protected?',
    badge: 'PSA Metadata & RA 10173',
  },
] as const;

export type {
  CbmsSectionCode,
  HeadlineChoroplethMetricId,
  LandmarkSectorId,
  PortalPageId,
  ReportIndicatorId,
  VulnerabilityCriterionId,
};
