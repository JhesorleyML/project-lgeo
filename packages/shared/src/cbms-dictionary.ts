/**
 * CBMS Survey Sections (A through O + Poverty) Metadata
 * Aligned with docs/cbms_erd_documentation.md & 001_initial_cbms_schema.sql
 */

export type CbmsSectionCode =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H_K_L'
  | 'I'
  | 'J'
  | 'M'
  | 'N'
  | 'O_HOUSING'
  | 'O_ASSETS'
  | 'POVERTY';

export interface CbmsSectionMeta {
  code: CbmsSectionCode;
  level: 'MEMBER' | 'HOUSEHOLD';
  title: string;
  tableName: string;
  columnRange: [number, number];
}

export const CBMS_SECTIONS: readonly CbmsSectionMeta[] = [
  {
    code: 'A',
    level: 'MEMBER',
    title: 'Section A: Core Demographic Characteristics',
    tableName: 'member_demographics_core',
    columnRange: [12, 30],
  },
  {
    code: 'B',
    level: 'MEMBER',
    title: 'Section B: Other Demographic Characteristics (PWD, Senior, Solo Parent)',
    tableName: 'member_demographics_other',
    columnRange: [31, 57],
  },
  {
    code: 'C',
    level: 'MEMBER',
    title: 'Section C: Migration & OFW Characteristics',
    tableName: 'member_migration',
    columnRange: [58, 69],
  },
  {
    code: 'D',
    level: 'MEMBER',
    title: 'Section D: Education & TVET',
    tableName: 'member_education',
    columnRange: [70, 83],
  },
  {
    code: 'E',
    level: 'MEMBER',
    title: 'Section E: Economic Characteristics & Employment',
    tableName: 'member_economics',
    columnRange: [84, 107],
  },
  {
    code: 'F',
    level: 'HOUSEHOLD',
    title: 'Section F: Health, Nutrition & Under-5 Mortality',
    tableName: 'household_health',
    columnRange: [133, 159],
  },
  {
    code: 'G',
    level: 'HOUSEHOLD',
    title: 'Section G: Food Security (FIES)',
    tableName: 'household_food_security',
    columnRange: [160, 167],
  },
  {
    code: 'H_K_L',
    level: 'HOUSEHOLD',
    title: 'Sections H, K, L: Public Transport, Internet Access & Public Safety',
    tableName: 'household_connectivity_safety',
    columnRange: [168, 206],
  },
  {
    code: 'I',
    level: 'HOUSEHOLD',
    title: 'Section I: Formal Financial Accounts',
    tableName: 'household_financial_accounts',
    columnRange: [169, 176],
  },
  {
    code: 'J',
    level: 'HOUSEHOLD',
    title: 'Section J: Negative Shocks & Disaster Preparedness',
    tableName: 'household_disaster_shocks',
    columnRange: [177, 199],
  },
  {
    code: 'M',
    level: 'HOUSEHOLD',
    title: 'Section M: Social Protection & Assistance Programs',
    tableName: 'household_social_protection',
    columnRange: [207, 232],
  },
  {
    code: 'N',
    level: 'HOUSEHOLD',
    title: 'Section N: Water, Sanitation & Hygiene (WASH)',
    tableName: 'household_wash',
    columnRange: [233, 264],
  },
  {
    code: 'O_HOUSING',
    level: 'HOUSEHOLD',
    title: 'Section O (Part 1): Housing Characteristics & Utilities',
    tableName: 'household_housing',
    columnRange: [265, 282],
  },
  {
    code: 'O_ASSETS',
    level: 'HOUSEHOLD',
    title: 'Section O (Part 2): Household Assets, ICT & Vehicles',
    tableName: 'household_assets',
    columnRange: [283, 305],
  },
  {
    code: 'POVERTY',
    level: 'HOUSEHOLD',
    title: 'Poverty & Near-Poor Vulnerability Thresholds (+5% to +25%)',
    tableName: 'household_poverty',
    columnRange: [306, 311],
  },
] as const;

export const HEADLINE_CHOROPLETH_METRICS = [
  { id: 'poor_rate', label: 'Poverty Incidence (Poor Households %)' },
  { id: 'near_poor_5_rate', label: 'Near-Poor (+5% Threshold %)' },
  { id: 'near_poor_10_rate', label: 'Near-Poor (+10% Threshold %)' },
  { id: 'near_poor_15_rate', label: 'Near-Poor (+15% Threshold %)' },
  { id: 'near_poor_20_rate', label: 'Near-Poor (+20% Threshold %)' },
  { id: 'near_poor_25_rate', label: 'Near-Poor (+25% Threshold %)' },
  { id: 'electricity_rate', label: 'Households with Electricity (%)' },
  { id: 'internet_rate', label: 'Households with Home Internet (%)' },
  { id: 'beneficiary_4ps_rate', label: '4Ps Beneficiary Coverage (%)' },
] as const;

export type HeadlineChoroplethMetricId = (typeof HEADLINE_CHOROPLETH_METRICS)[number]['id'];

export type VulnerabilityCriterionId =
  | 'poor'
  | 'near_poor_5'
  | 'senior_citizen'
  | 'pwd'
  | 'solo_parent'
  | 'food_insecure'
  | 'no_electricity'
  | 'no_internet'
  | 'no_4ps_poor'
  | 'unimproved_water'
  | 'makeshift_housing'
  | 'disaster_shock';

export interface VulnerabilityCriterionMeta {
  id: VulnerabilityCriterionId;
  sectionCode: CbmsSectionCode;
  label: string;
  shortLabel: string;
  columnRef: string;
  description: string;
}

export const VULNERABILITY_CRITERIA: readonly VulnerabilityCriterionMeta[] = [
  {
    id: 'poor',
    sectionCode: 'POVERTY',
    label: 'Poor Household (Below Poverty Threshold)',
    shortLabel: 'Poor HH',
    columnRef: 'poor = 1 (Col 306)',
    description: 'Households classified below the official CBMS poverty threshold.',
  },
  {
    id: 'near_poor_5',
    sectionCode: 'POVERTY',
    label: 'Near-Poor (+5% Vulnerability Buffer)',
    shortLabel: 'Near-Poor +5%',
    columnRef: 'near_poor_5_pct = 1 (Col 307)',
    description: 'Households within 5% above the poverty threshold at high risk of falling into poverty.',
  },
  {
    id: 'senior_citizen',
    sectionCode: 'A',
    label: 'With Senior Citizen Member (Age ≥ 60)',
    shortLabel: 'Senior (60+)',
    columnRef: 'a05_age >= 60 (Col 21)',
    description: 'Households with at least one member aged 60 years or older (Section A / B07).',
  },
  {
    id: 'pwd',
    sectionCode: 'B',
    label: 'With Person with Disability (PWD)',
    shortLabel: 'With PWD',
    columnRef: 'b10_pwd = 1 (Col 39)',
    description: 'Households with at least one member with a functional or diagnosed disability (Section B).',
  },
  {
    id: 'solo_parent',
    sectionCode: 'B',
    label: 'With Solo Parent Member',
    shortLabel: 'Solo Parent',
    columnRef: 'b05_solo_parent = 1 (Col 34)',
    description: 'Households with a solo parent member under RA 8972 / RA 11861 (Section B).',
  },
  {
    id: 'food_insecure',
    sectionCode: 'G',
    label: 'Food Insecure / Experienced Hunger (FIES)',
    shortLabel: 'Food Insecure',
    columnRef: 'g04_skipped_meal = 1 OR g07_hungry = 1 (Cols 160–167)',
    description: 'Households reporting skipped meals, running out of food, or hunger in Section G.',
  },
  {
    id: 'no_4ps_poor',
    sectionCode: 'M',
    label: 'Poor / Near-Poor Not Covered by 4Ps (Undercoverage)',
    shortLabel: '4Ps Gap',
    columnRef: 'poor = 1 AND m05_a_4ps != 1 (Col 217)',
    description: 'Income-poor households not currently enrolled in the Pantawid Pamilyang Pilipino Program.',
  },
  {
    id: 'unimproved_water',
    sectionCode: 'N',
    label: 'Level I / Unimproved Drinking Water Source',
    shortLabel: 'Unimproved Water',
    columnRef: 'n02_drinking_water (Col 234)',
    description: 'Households without piped Level III or safe community water access (Section N WASH).',
  },
  {
    id: 'makeshift_housing',
    sectionCode: 'O_HOUSING',
    label: 'Light / Salvaged Roof or Outer Walls',
    shortLabel: 'Light/Salvaged Housing',
    columnRef: 'o03_roof / o04_outer_walls (Cols 267, 269)',
    description: 'Dwellings constructed with light (nipa/cogon/bamboo) or salvaged/makeshift materials.',
  },
  {
    id: 'no_electricity',
    sectionCode: 'O_HOUSING',
    label: 'Without Household Electricity',
    shortLabel: 'No Electricity',
    columnRef: 'o11_electricity = 2 (Col 280)',
    description: 'Households without electricity connection in the dwelling (Section O).',
  },
  {
    id: 'no_internet',
    sectionCode: 'H_K_L',
    label: 'Without Home Internet Connection',
    shortLabel: 'No Home Internet',
    columnRef: 'k02_internet_at_home = 2 (Col 201)',
    description: 'Households without fixed or wireless broadband internet at home (Section K).',
  },
  {
    id: 'disaster_shock',
    sectionCode: 'J',
    label: 'Affected by Typhoon / Flood / Climate Shock',
    shortLabel: 'Climate/Disaster Shock',
    columnRef: 'j01_a_typhoon = 1 OR j01_d_rain_or_flood = 1 (Cols 177–181)',
    description: 'Households severely impacted by typhoons, coastal flooding, or landslides in the past 12 months.',
  },
] as const;

/**
 * 8 Official CBMS Report & Planning Dimensions covering all 15 CBMS Sections (A-O + Poverty)
 */
export type CbmsReportDimensionId =
  | 'DEMOGRAPHICS'
  | 'EDUCATION'
  | 'HEALTH_DISABILITY'
  | 'LIVELIHOOD_MIGRATION'
  | 'POVERTY_FINANCE'
  | 'SOCIAL_PROTECTION'
  | 'WASH_HOUSING_ASSETS'
  | 'CONNECTIVITY_DRRM';

export interface CbmsReportDimensionMeta {
  id: CbmsReportDimensionId;
  title: string;
  shortTitle: string;
  sections: readonly CbmsSectionCode[];
  description: string;
}

export const CBMS_REPORT_DIMENSIONS: readonly CbmsReportDimensionMeta[] = [
  {
    id: 'DEMOGRAPHICS',
    title: '1. Demographics & Civil Registry (Sections A & B)',
    shortTitle: 'Demographics & Registry',
    sections: ['A', 'B'],
    description: 'Age cohorts (Senior Citizens, Children, Youth), Solo Parents, Maternal status, Birth Registration (LCR), and PhilSys National ID.',
  },
  {
    id: 'EDUCATION',
    title: '2. Education, Literacy & TVET (Sections A & D)',
    shortTitle: 'Education & OSY',
    sections: ['A', 'D'],
    description: 'Out-of-School Youth (OSY), School Attendance, Basic Literacy, and Technical-Vocational (TVET) completion.',
  },
  {
    id: 'HEALTH_DISABILITY',
    title: '3. Health, Nutrition & Disability (Sections B & F)',
    shortTitle: 'Health & Disability',
    sections: ['B', 'F'],
    description: 'Persons with Disability (PWD), Morbidity & Unmet Medical Treatment Need, and Under-5 Child Mortality.',
  },
  {
    id: 'LIVELIHOOD_MIGRATION',
    title: '4. Employment, Livelihood & Migration (Sections C & E)',
    shortTitle: 'Employment & Livelihood',
    sections: ['C', 'E'],
    description: 'Fisherfolk, Farmers, Unemployment, Underemployment, Overseas Filipino Workers (OFW), and Calamity Displacement.',
  },
  {
    id: 'POVERTY_FINANCE',
    title: '5. Poverty, Income, Food Security & Finance (Sections G, I & Poverty)',
    shortTitle: 'Poverty, Food & Finance',
    sections: ['POVERTY', 'G', 'I'],
    description: 'Poor & Near-Poor (+5% to +25% Vulnerability Thresholds), Food Insecurity (FIES), and Financial Account Inclusion.',
  },
  {
    id: 'SOCIAL_PROTECTION',
    title: '6. Social Protection & Assistance Programs (Section M)',
    shortTitle: 'Social Protection (4Ps)',
    sections: ['M'],
    description: '4Ps Beneficiaries, 4Ps Undercoverage Gap, Social Pension (SocPen), AICS / LGU Assistance, and PhilHealth coverage.',
  },
  {
    id: 'WASH_HOUSING_ASSETS',
    title: '7. WASH, Housing, Utilities & Household Assets (Sections N & O)',
    shortTitle: 'WASH, Housing & Assets',
    sections: ['N', 'O_HOUSING', 'O_ASSETS'],
    description: 'Safe Drinking Water, Sanitary Toilet Access, Light/Salvaged Housing, Informal Tenure, Electricity, and Boat/Vehicle Assets.',
  },
  {
    id: 'CONNECTIVITY_DRRM',
    title: '8. Digital Connectivity, Transport & Climate Shocks (Sections H, J, K, L)',
    shortTitle: 'Connectivity & DRRM',
    sections: ['H_K_L', 'J'],
    description: 'Home Internet Access, Public Transport (PUV within 500m), Typhoon/Flood/Landslide Exposure, and Evacuation Center Awareness.',
  },
] as const;

export type ReportIndicatorId =
  // Dimension 1: Demographics & Civil Registry (Sections A & B)
  | 'senior_citizen'
  | 'children_under_5'
  | 'youth_school_age'
  | 'solo_parent'
  | 'pregnant_or_lactating'
  | 'unregistered_birth_lcr'
  | 'no_philsys_id'
  // Dimension 2: Education, Literacy & TVET (Sections A & D)
  | 'out_of_school_youth'
  | 'attending_school'
  | 'non_literate'
  | 'tvet_graduate_or_attending'
  // Dimension 3: Health, Nutrition & Disability (Sections B & F)
  | 'pwd'
  | 'sick_without_treatment'
  | 'under5_mortality'
  // Dimension 4: Employment, Livelihood & Migration (Sections C & E)
  | 'fisherfolk'
  | 'farmer'
  | 'unemployed'
  | 'underemployed'
  | 'ofw_member'
  | 'calamity_displaced'
  // Dimension 5: Poverty, Food Security & Finance (Sections G, I & Poverty)
  | 'poor'
  | 'near_poor_5'
  | 'near_poor_10'
  | 'near_poor_15'
  | 'near_poor_20'
  | 'near_poor_25'
  | 'food_insecure'
  | 'unbanked_household'
  // Dimension 6: Social Protection & Assistance (Section M)
  | 'beneficiary_4ps'
  | 'no_4ps_poor'
  | 'socpen_beneficiary'
  | 'aics_or_lgu_assistance'
  | 'no_philhealth'
  // Dimension 7: WASH, Housing, Utilities & Assets (Sections N & O)
  | 'unimproved_water'
  | 'unimproved_sanitation'
  | 'makeshift_housing'
  | 'informal_settler'
  | 'no_electricity'
  | 'banca_owner'
  // Dimension 8: Connectivity, Transport & Climate Shocks (Sections H, J, K, L)
  | 'no_internet'
  | 'with_internet'
  | 'no_puv_access'
  | 'disaster_shock'
  | 'unaware_evacuation_center';

export interface CbmsReportIndicatorMeta {
  id: ReportIndicatorId;
  dimensionId: CbmsReportDimensionId;
  sectionCode: CbmsSectionCode;
  level: 'MEMBER' | 'HOUSEHOLD';
  requiredTables: readonly string[];
  label: string;
  shortLabel: string;
  columnRef: string;
  description: string;
}

export const CBMS_REPORT_INDICATORS: readonly CbmsReportIndicatorMeta[] = [
  // 1. DEMOGRAPHICS & CIVIL REGISTRY (Sections A & B)
  {
    id: 'senior_citizen',
    dimensionId: 'DEMOGRAPHICS',
    sectionCode: 'A',
    level: 'MEMBER',
    requiredTables: ['member_demographics_core'],
    label: 'Senior Citizen Member (Age ≥ 60)',
    shortLabel: 'Senior Citizen (60+)',
    columnRef: 'a05_age >= 60 (Col 21)',
    description: 'Members aged 60 years or older (or households with at least one senior citizen).',
  },
  {
    id: 'children_under_5',
    dimensionId: 'DEMOGRAPHICS',
    sectionCode: 'A',
    level: 'MEMBER',
    requiredTables: ['member_demographics_core'],
    label: 'Young Child Under 5 Years Old (Age 0–4)',
    shortLabel: 'Under-5 Child (0–4)',
    columnRef: 'a05_age < 5 (Col 21)',
    description: 'Early childhood population aged 0 to 4 years requiring ECCD and immunization coverage.',
  },
  {
    id: 'youth_school_age',
    dimensionId: 'DEMOGRAPHICS',
    sectionCode: 'A',
    level: 'MEMBER',
    requiredTables: ['member_demographics_core'],
    label: 'School-Age & Youth Population (Age 6–24)',
    shortLabel: 'Youth (Age 6–24)',
    columnRef: 'a05_age BETWEEN 6 AND 24 (Col 21)',
    description: 'Members within the official school-age and youth cohort (6 to 24 years old).',
  },
  {
    id: 'solo_parent',
    dimensionId: 'DEMOGRAPHICS',
    sectionCode: 'B',
    level: 'MEMBER',
    requiredTables: ['member_demographics_other'],
    label: 'Solo Parent Member (RA 11861)',
    shortLabel: 'Solo Parent',
    columnRef: 'b05_solo_parent = 1 (Col 34)',
    description: 'Solo parent household members identified in Section B.',
  },
  {
    id: 'pregnant_or_lactating',
    dimensionId: 'DEMOGRAPHICS',
    sectionCode: 'B',
    level: 'MEMBER',
    requiredTables: ['member_demographics_other'],
    label: 'Pregnant or Lactating Mother',
    shortLabel: 'Pregnant/Lactating',
    columnRef: 'b08_currently_pregnant = 1 OR b09_lactating_mother = 1 (Cols 37–38)',
    description: 'Maternal health target group (currently pregnant or breastfeeding mothers).',
  },
  {
    id: 'unregistered_birth_lcr',
    dimensionId: 'DEMOGRAPHICS',
    sectionCode: 'A',
    level: 'MEMBER',
    requiredTables: ['member_demographics_core'],
    label: 'Birth Not Registered with Local Civil Registrar (LCR)',
    shortLabel: 'Unregistered Birth',
    columnRef: 'a06_lcr_reg_status = 2 (Col 23)',
    description: 'Members whose birth is not registered with the Local Civil Registrar.',
  },
  {
    id: 'no_philsys_id',
    dimensionId: 'DEMOGRAPHICS',
    sectionCode: 'B',
    level: 'MEMBER',
    requiredTables: ['member_demographics_other'],
    label: 'Without PhilSys National ID',
    shortLabel: 'No PhilSys ID',
    columnRef: 'b03_phil_id = 2 (Col 33)',
    description: 'Members not yet registered in the Philippine Identification System (PhilSys).',
  },

  // 2. EDUCATION, LITERACY & TVET (Sections A & D)
  {
    id: 'out_of_school_youth',
    dimensionId: 'EDUCATION',
    sectionCode: 'D',
    level: 'MEMBER',
    requiredTables: ['member_demographics_core', 'member_education'],
    label: 'Out-of-School Youth & Children (Age 6–24 Not Attending School)',
    shortLabel: 'Out-of-School Youth (OSY)',
    columnRef: 'a05_age BETWEEN 6 AND 24 AND d01_currently_attending_school = 2 (Cols 21, 70)',
    description: 'Children and youth aged 6–24 not currently attending formal school.',
  },
  {
    id: 'attending_school',
    dimensionId: 'EDUCATION',
    sectionCode: 'D',
    level: 'MEMBER',
    requiredTables: ['member_education'],
    label: 'Currently Attending School',
    shortLabel: 'Attending School',
    columnRef: 'd01_currently_attending_school = 1 (Col 70)',
    description: 'Members currently enrolled and attending school.',
  },
  {
    id: 'non_literate',
    dimensionId: 'EDUCATION',
    sectionCode: 'A',
    level: 'MEMBER',
    requiredTables: ['member_demographics_core'],
    label: 'Basic Literacy Gap (Age ≥ 10 Cannot Read/Write Simple Message)',
    shortLabel: 'Non-Literate (10+)',
    columnRef: 'a05_age >= 10 AND a10_simple_literacy = 2 (Cols 21, 27)',
    description: 'Members aged 10 years and older unable to read and write a simple message.',
  },
  {
    id: 'tvet_graduate_or_attending',
    dimensionId: 'EDUCATION',
    sectionCode: 'D',
    level: 'MEMBER',
    requiredTables: ['member_education'],
    label: 'TVET Graduate or Currently Attending TESDA/Vocational Course',
    shortLabel: 'TVET Graduate/Trainee',
    columnRef: 'd07_tvet_graduate = 1 OR d08_tvet_currently_attending = 1 (Cols 82–83)',
    description: 'Members who completed or are currently attending Technical-Vocational Education and Training.',
  },

  // 3. HEALTH, NUTRITION & DISABILITY (Sections B & F)
  {
    id: 'pwd',
    dimensionId: 'HEALTH_DISABILITY',
    sectionCode: 'B',
    level: 'MEMBER',
    requiredTables: ['member_demographics_other'],
    label: 'Person with Disability (PWD)',
    shortLabel: 'With PWD',
    columnRef: 'b10_pwd = 1 (Col 39)',
    description: 'Members with functional or diagnosed disability in Section B.',
  },
  {
    id: 'sick_without_treatment',
    dimensionId: 'HEALTH_DISABILITY',
    sectionCode: 'F',
    level: 'HOUSEHOLD',
    requiredTables: ['household_health'],
    label: 'Household with Sick Member Who Did Not Avail Medical Treatment',
    shortLabel: 'Unmet Medical Need',
    columnRef: 'f01_with_member_who_has_been_sick = 1 AND f02_availed_medical_treatment = 2 (Cols 133–134)',
    description: 'Households reporting illness in the past 12 months that did not receive medical treatment.',
  },
  {
    id: 'under5_mortality',
    dimensionId: 'HEALTH_DISABILITY',
    sectionCode: 'F',
    level: 'HOUSEHOLD',
    requiredTables: ['household_health'],
    label: 'Household Experiencing Child Mortality (Section F06)',
    shortLabel: 'Child Mortality (Sec F)',
    columnRef: 'f06_with_child_died = 1 (Col 158)',
    description: 'Households reporting a deceased child in Section F.',
  },

  // 4. EMPLOYMENT, LIVELIHOOD & MIGRATION (Sections C & E)
  {
    id: 'fisherfolk',
    dimensionId: 'LIVELIHOOD_MIGRATION',
    sectionCode: 'E',
    level: 'MEMBER',
    requiredTables: ['member_economics'],
    label: 'Fisherfolk / Coastal Fishing Livelihood (Section E18)',
    shortLabel: 'Fisherfolk',
    columnRef: 'e18_fisherfolk = 1 (Col 107)',
    description: 'Members engaged in municipal or commercial fishing activities.',
  },
  {
    id: 'farmer',
    dimensionId: 'LIVELIHOOD_MIGRATION',
    sectionCode: 'E',
    level: 'MEMBER',
    requiredTables: ['member_economics'],
    label: 'Farmer / Agricultural Worker (Section E17)',
    shortLabel: 'Farmer',
    columnRef: 'e17_farmer = 1 (Col 106)',
    description: 'Members engaged in crop farming, livestock, or agricultural labor.',
  },
  {
    id: 'unemployed',
    dimensionId: 'LIVELIHOOD_MIGRATION',
    sectionCode: 'E',
    level: 'MEMBER',
    requiredTables: ['member_economics'],
    label: 'Unemployed / Looking for Work (Section E01/E13)',
    shortLabel: 'Unemployed',
    columnRef: 'e01_employment_status = 2 OR e13_try_look_for_work = 1 (Cols 85, 102)',
    description: 'Labor force members without work and actively looking or available for work.',
  },
  {
    id: 'underemployed',
    dimensionId: 'LIVELIHOOD_MIGRATION',
    sectionCode: 'E',
    level: 'MEMBER',
    requiredTables: ['member_economics'],
    label: 'Underemployed / Wanting Additional Work Hours',
    shortLabel: 'Underemployed',
    columnRef: 'e01_underemployment_status = 1 OR e12_want_more_hours = 1 (Cols 86, 101)',
    description: 'Employed members expressing desire for additional hours of work.',
  },
  {
    id: 'ofw_member',
    dimensionId: 'LIVELIHOOD_MIGRATION',
    sectionCode: 'C',
    level: 'MEMBER',
    requiredTables: ['member_migration'],
    label: 'Overseas Filipino Worker (OFW / Overseas Indicator)',
    shortLabel: 'OFW Member',
    columnRef: 'c02_ofi IN (1, 2, 3) (Col 59)',
    description: 'Members working or residing overseas (Section C02).',
  },
  {
    id: 'calamity_displaced',
    dimensionId: 'LIVELIHOOD_MIGRATION',
    sectionCode: 'C',
    level: 'MEMBER',
    requiredTables: ['member_migration'],
    label: 'Internally Displaced by Natural Calamity (Section C06)',
    shortLabel: 'Calamity Displaced',
    columnRef: 'c06_internal_displacement = 2 (Col 69)',
    description: 'Members who experienced internal displacement due to natural disasters.',
  },

  // 5. POVERTY, INCOME, FOOD SECURITY & FINANCE (Sections G, I & Poverty)
  {
    id: 'poor',
    dimensionId: 'POVERTY_FINANCE',
    sectionCode: 'POVERTY',
    level: 'HOUSEHOLD',
    requiredTables: ['household_poverty'],
    label: 'Poor Household (Below Official Poverty Threshold)',
    shortLabel: 'Poor HH',
    columnRef: 'poor = 1 (Col 306)',
    description: 'Households classified below the official CBMS poverty threshold.',
  },
  {
    id: 'near_poor_5',
    dimensionId: 'POVERTY_FINANCE',
    sectionCode: 'POVERTY',
    level: 'HOUSEHOLD',
    requiredTables: ['household_poverty'],
    label: 'Near-Poor (+5% Vulnerability Buffer)',
    shortLabel: 'Near-Poor +5%',
    columnRef: 'near_poor_5_pct = 1 (Col 307)',
    description: 'Households within +5% above the poverty threshold.',
  },
  {
    id: 'near_poor_10',
    dimensionId: 'POVERTY_FINANCE',
    sectionCode: 'POVERTY',
    level: 'HOUSEHOLD',
    requiredTables: ['household_poverty'],
    label: 'Near-Poor (+10% Vulnerability Buffer)',
    shortLabel: 'Near-Poor +10%',
    columnRef: 'near_poor_10_pct = 1 (Col 308)',
    description: 'Households within +10% above the poverty threshold.',
  },
  {
    id: 'near_poor_15',
    dimensionId: 'POVERTY_FINANCE',
    sectionCode: 'POVERTY',
    level: 'HOUSEHOLD',
    requiredTables: ['household_poverty'],
    label: 'Near-Poor (+15% Vulnerability Buffer)',
    shortLabel: 'Near-Poor +15%',
    columnRef: 'near_poor_15_pct = 1 (Col 309)',
    description: 'Households within +15% above the poverty threshold.',
  },
  {
    id: 'near_poor_20',
    dimensionId: 'POVERTY_FINANCE',
    sectionCode: 'POVERTY',
    level: 'HOUSEHOLD',
    requiredTables: ['household_poverty'],
    label: 'Near-Poor (+20% Vulnerability Buffer)',
    shortLabel: 'Near-Poor +20%',
    columnRef: 'near_poor_20_pct = 1 (Col 310)',
    description: 'Households within +20% above the poverty threshold.',
  },
  {
    id: 'near_poor_25',
    dimensionId: 'POVERTY_FINANCE',
    sectionCode: 'POVERTY',
    level: 'HOUSEHOLD',
    requiredTables: ['household_poverty'],
    label: 'Near-Poor (+25% Vulnerability Buffer)',
    shortLabel: 'Near-Poor +25%',
    columnRef: 'near_poor_25_pct = 1 (Col 311)',
    description: 'Households within +25% above the poverty threshold.',
  },
  {
    id: 'food_insecure',
    dimensionId: 'POVERTY_FINANCE',
    sectionCode: 'G',
    level: 'HOUSEHOLD',
    requiredTables: ['household_food_security'],
    label: 'Food Insecure / Experienced Hunger (Section G FIES)',
    shortLabel: 'Food Insecure',
    columnRef: 'g04_skipped_meal = 1 OR g06_ran_out_of_food = 1 OR g07_hungry = 1 (Cols 163–167)',
    description: 'Households reporting skipped meals, running out of food, or hunger.',
  },
  {
    id: 'unbanked_household',
    dimensionId: 'POVERTY_FINANCE',
    sectionCode: 'I',
    level: 'HOUSEHOLD',
    requiredTables: ['household_financial_accounts'],
    label: 'Unbanked Household (No Formal Bank / E-Money / Coop Account)',
    shortLabel: 'Unbanked HH',
    columnRef: 'i01_a_bank_account != 1 AND i01_b_digital_bank_account != 1 AND i01_c_emoney_or_cash_card != 1 (Cols 169–175)',
    description: 'Households without any formal bank, digital bank, e-money, or cooperative financial account.',
  },

  // 6. SOCIAL PROTECTION & ASSISTANCE (Section M)
  {
    id: 'beneficiary_4ps',
    dimensionId: 'SOCIAL_PROTECTION',
    sectionCode: 'M',
    level: 'HOUSEHOLD',
    requiredTables: ['household_social_protection'],
    label: '4Ps Beneficiary Household (Pantawid Pamilya)',
    shortLabel: '4Ps Beneficiary',
    columnRef: 'm05_a_4ps = 1 (Col 217)',
    description: 'Households enrolled in the Pantawid Pamilyang Pilipino Program (4Ps).',
  },
  {
    id: 'no_4ps_poor',
    dimensionId: 'SOCIAL_PROTECTION',
    sectionCode: 'M',
    level: 'HOUSEHOLD',
    requiredTables: ['household_poverty', 'household_social_protection'],
    label: '4Ps Undercoverage Gap (Poor Household Not Covered by 4Ps)',
    shortLabel: '4Ps Gap (Poor No 4Ps)',
    columnRef: 'poor = 1 AND m05_a_4ps != 1 (Cols 217, 306)',
    description: 'Income-poor households not currently receiving 4Ps conditional cash transfers.',
  },
  {
    id: 'socpen_beneficiary',
    dimensionId: 'SOCIAL_PROTECTION',
    sectionCode: 'M',
    level: 'HOUSEHOLD',
    requiredTables: ['household_social_protection'],
    label: 'Social Pension (SocPen) for Indigent Senior Citizens',
    shortLabel: 'SocPen Beneficiary',
    columnRef: 'm05_b_socpen = 1 (Col 218)',
    description: 'Households receiving DSWD Social Pension for Indigent Senior Citizens.',
  },
  {
    id: 'aics_or_lgu_assistance',
    dimensionId: 'SOCIAL_PROTECTION',
    sectionCode: 'M',
    level: 'HOUSEHOLD',
    requiredTables: ['household_social_protection'],
    label: 'AICS / LGU Social Assistance Recipient',
    shortLabel: 'AICS / LGU Aid',
    columnRef: 'm05_c_aics = 1 OR m05_g_lgu_assistance = 1 (Cols 219, 223)',
    description: 'Households that received Assistance to Individuals in Crisis Situations (AICS) or LGU aid.',
  },
  {
    id: 'no_philhealth',
    dimensionId: 'SOCIAL_PROTECTION',
    sectionCode: 'M',
    level: 'HOUSEHOLD',
    requiredTables: ['household_social_protection'],
    label: 'Without PhilHealth Membership Coverage',
    shortLabel: 'No PhilHealth',
    columnRef: 'm01_c_philhealth != 1 (Col 209)',
    description: 'Households without active PhilHealth health insurance membership.',
  },

  // 7. WASH, HOUSING, UTILITIES & ASSETS (Sections N & O)
  {
    id: 'unimproved_water',
    dimensionId: 'WASH_HOUSING_ASSETS',
    sectionCode: 'N',
    level: 'HOUSEHOLD',
    requiredTables: ['household_wash'],
    label: 'Level I / Unimproved Drinking Water Source',
    shortLabel: 'Unimproved Water',
    columnRef: 'n03_service_level_drinking_water > 1 (Cols 234–235)',
    description: 'Households without piped Level III or safe managed drinking water access.',
  },
  {
    id: 'unimproved_sanitation',
    dimensionId: 'WASH_HOUSING_ASSETS',
    sectionCode: 'N',
    level: 'HOUSEHOLD',
    requiredTables: ['household_wash'],
    label: 'Unimproved Sanitation / No Sanitary Toilet Facility',
    shortLabel: 'Unsanitary Toilet',
    columnRef: 'n08_service_level_toilet_facility > 2 (Cols 242–243)',
    description: 'Households with unimproved, shared, or no sanitary toilet facility.',
  },
  {
    id: 'makeshift_housing',
    dimensionId: 'WASH_HOUSING_ASSETS',
    sectionCode: 'O_HOUSING',
    level: 'HOUSEHOLD',
    requiredTables: ['household_housing'],
    label: 'Light / Salvaged Roof or Outer Walls',
    shortLabel: 'Light/Salvaged Housing',
    columnRef: 'o03_roof >= 3 OR o04_outer_walls >= 3 (Cols 267, 269)',
    description: 'Dwellings constructed with light (nipa/cogon/bamboo) or salvaged materials.',
  },
  {
    id: 'informal_settler',
    dimensionId: 'WASH_HOUSING_ASSETS',
    sectionCode: 'O_HOUSING',
    level: 'HOUSEHOLD',
    requiredTables: ['household_housing'],
    label: 'Informal Settler / Rent-Free Without Owner Consent',
    shortLabel: 'Informal Settler',
    columnRef: 'o09_tenure IN (5, 6) (Col 277)',
    description: 'Households occupying house/lot without consent of owner (Section O09).',
  },
  {
    id: 'no_electricity',
    dimensionId: 'WASH_HOUSING_ASSETS',
    sectionCode: 'O_HOUSING',
    level: 'HOUSEHOLD',
    requiredTables: ['household_housing'],
    label: 'Without Household Electricity Connection',
    shortLabel: 'No Electricity',
    columnRef: 'o11_electricity != 1 (Col 280)',
    description: 'Households without electricity in the dwelling (Section O11).',
  },
  {
    id: 'banca_owner',
    dimensionId: 'WASH_HOUSING_ASSETS',
    sectionCode: 'O_ASSETS',
    level: 'HOUSEHOLD',
    requiredTables: ['household_assets'],
    label: 'Owns Motorized or Non-Motorized Banca / Boat (Section O14)',
    shortLabel: 'Banca / Boat Owner',
    columnRef: 'o14_v_banca_motorized > 0 OR o14_w_banca_nonmotorized > 0 (Cols 304–305)',
    description: 'Coastal households owning a motorized or non-motorized fishing/transport boat.',
  },

  // 8. CONNECTIVITY, TRANSPORT & CLIMATE SHOCKS (Sections H, J, K, L)
  {
    id: 'no_internet',
    dimensionId: 'CONNECTIVITY_DRRM',
    sectionCode: 'H_K_L',
    level: 'HOUSEHOLD',
    requiredTables: ['household_connectivity_safety'],
    label: 'Without Home Internet Connection',
    shortLabel: 'No Home Internet',
    columnRef: 'k02_internet_at_home != 1 (Col 201)',
    description: 'Households without fixed or wireless broadband internet at home.',
  },
  {
    id: 'with_internet',
    dimensionId: 'CONNECTIVITY_DRRM',
    sectionCode: 'H_K_L',
    level: 'HOUSEHOLD',
    requiredTables: ['household_connectivity_safety'],
    label: 'With Home Internet Connection',
    shortLabel: 'With Home Internet',
    columnRef: 'k02_internet_at_home = 1 (Col 201)',
    description: 'Households with home broadband or wireless internet connection.',
  },
  {
    id: 'no_puv_access',
    dimensionId: 'CONNECTIVITY_DRRM',
    sectionCode: 'H_K_L',
    level: 'HOUSEHOLD',
    requiredTables: ['household_connectivity_safety'],
    label: 'No Public Utility Vehicle (PUV) Stop Within 500m (Section H01)',
    shortLabel: 'No PUV Within 500m',
    columnRef: 'h01_puv_access = 2 (Col 168)',
    description: 'Households without accessible public transportation within 500 meters.',
  },
  {
    id: 'disaster_shock',
    dimensionId: 'CONNECTIVITY_DRRM',
    sectionCode: 'J',
    level: 'HOUSEHOLD',
    requiredTables: ['household_disaster_shocks'],
    label: 'Affected by Typhoon, Flood, or Landslide (Section J01)',
    shortLabel: 'Climate/Disaster Shock',
    columnRef: 'j01_a_typhoon = 1 OR j01_d_rain_or_flood = 1 OR j01_e_erosion_landslide = 1 (Cols 177–181)',
    description: 'Households severely impacted by typhoons, flooding, or landslides in the past 12 months.',
  },
  {
    id: 'unaware_evacuation_center',
    dimensionId: 'CONNECTIVITY_DRRM',
    sectionCode: 'J',
    level: 'HOUSEHOLD',
    requiredTables: ['household_disaster_shocks'],
    label: 'Unaware of Barangay Evacuation Center Location (Section J02)',
    shortLabel: 'Unaware of Evac Center',
    columnRef: 'j02_location_of_evacuation = 2 (Col 198)',
    description: 'Households that do not know the location of their designated evacuation center.',
  },
] as const;

export const REPORT_INDICATOR_MAP: ReadonlyMap<ReportIndicatorId, CbmsReportIndicatorMeta> =
  new Map(CBMS_REPORT_INDICATORS.map((ind) => [ind.id, ind]));

/**
 * Computes the minimal set of database tables required to evaluate a subset of report indicators.
 * Enforces AGENTS.md §5: "ALWAYS prune unused CBMS Section Joins".
 */
export function getRequiredTablesForIndicators(
  indicatorIds: readonly ReportIndicatorId[],
): {
  householdTables: Set<string>;
  memberTables: Set<string>;
} {
  const householdTables = new Set<string>();
  const memberTables = new Set<string>();

  for (const id of indicatorIds) {
    const meta = REPORT_INDICATOR_MAP.get(id);
    if (!meta) continue;
    for (const tbl of meta.requiredTables) {
      if (tbl.startsWith('household_')) {
        householdTables.add(tbl);
      } else if (tbl.startsWith('member_')) {
        memberTables.add(tbl);
      }
    }
  }

  return { householdTables, memberTables };
}

