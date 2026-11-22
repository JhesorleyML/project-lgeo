import { z } from 'zod';
import { UserRoleSchema, type ReportTypeId } from './rbac.js';
import { REPORT_INDICATOR_MAP, type ReportIndicatorId } from './cbms-dictionary.js';

export const ChoroplethQuerySchema = z.object({
  surveyYear: z.coerce.number().int().min(2000).max(2100).default(2024),
  metric: z.string().default('poor_rate'),
});

export type ChoroplethQuery = z.infer<typeof ChoroplethQuerySchema>;

export type LandmarkSectorId =
  | 'ALL'
  | 'HEALTH_WELFARE'
  | 'DRRM_EVACUATION'
  | 'EDUCATION'
  | 'GOVERNANCE'
  | 'TRANSPORT_LIFELINES'
  | 'COMMERCE_ENVIRONMENT';

export interface LandmarkSectorMeta {
  id: Exclude<LandmarkSectorId, 'ALL'>;
  label: string;
  color: string;
  description: string;
}

export const LANDMARK_SECTORS: readonly LandmarkSectorMeta[] = [
  {
    id: 'HEALTH_WELFARE',
    label: 'Health & Social Welfare',
    color: '#f43f5e',
    description: 'Health Stations, Birthing Clinics, ECCD Day Care Centers',
  },
  {
    id: 'DRRM_EVACUATION',
    label: 'DRRM & Evacuation',
    color: '#f97316',
    description: 'Evacuation Centers, Multi-Purpose Gyms, Fire & Police Stations',
  },
  {
    id: 'EDUCATION',
    label: 'Education & ALS',
    color: '#3b82f6',
    description: 'Elementary, Secondary, and Alternative Learning System Schools',
  },
  {
    id: 'GOVERNANCE',
    label: 'Governance & Civic',
    color: '#10b981',
    description: 'Municipal Hall, Provincial Capitol, Barangay Halls & Line Agencies',
  },
  {
    id: 'TRANSPORT_LIFELINES',
    label: 'Transport & Lifelines',
    color: '#06b6d4',
    description: 'Seaports, Bridges, Terminals, Power (NPC/Coop) & Fuel Stations',
  },
  {
    id: 'COMMERCE_ENVIRONMENT',
    label: 'Commerce, Food & WASH',
    color: '#a855f7',
    description: 'Public Markets, NFA/Rice Mills, MRF Solid Waste & Community Sites',
  },
] as const;

export type RoadColorMode = 'class' | 'condition';

export interface BarangayIndicatorSummary {
  surveyYear: number;
  barangayGeoCode: string;
  barangayName: string;
  cityMunGeoCode: string;
  cityMunName: string;
  totalHouseholds: number;
  totalPopulation: number;
  totalMales: number;
  totalFemales: number;
  poorHouseholds: number;
  nearPoor5Households: number;
  nearPoor10Households: number;
  nearPoor15Households: number;
  nearPoor20Households: number;
  nearPoor25Households: number;
  householdsWithElectricity: number;
  householdsWithHomeInternet: number;
  households4psBeneficiaries: number;
}

export interface LandUseFeatureProperties {
  id: number;
  luName: string;
  luCategory: string;
  areaHectares: number;
  perimeterLength: number;
}

export interface LandmarkFeatureProperties {
  id: number;
  name: string;
  landmarkType: string;
  sectorCategory: Exclude<LandmarkSectorId, 'ALL'>;
  barangayGeoCode: string | null;
  barangayName: string | null;
  longitude: number;
  latitude: number;
}

export interface RoadFeatureProperties {
  id: number;
  roadName: string;
  roadClass: string;
  barangayName: string | null;
  surfaceType: string;
  roadCondition: string;
  widthMeters: number | null;
  lengthMeters: number;
}

export interface LandmarkCatchmentSummary {
  landmarkId: number;
  landmarkName: string;
  landmarkType: string;
  sectorCategory: string;
  radiusMeters: number;
  surveyYear: number;
  householdsInRadius: number;
  populationInRadius: number;
  poorHouseholdsInRadius: number;
  bufferGeoJson: unknown;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: z.infer<typeof UserRoleSchema>;
}

export type PortalPageId = 'dashboard' | 'map' | 'uploads' | 'reports' | 'yoy' | 'users';

export type ReportExportFormat = 'xlsx' | 'csv';
export type ReportCriteriaMatchMode = 'all' | 'any';

export const ReportFilterQuerySchema = z.object({
  surveyYear: z.coerce.number().int().min(2000).max(2100).default(2024),
  reportType: z
    .enum(['BARANGAY_SUMMARY', 'HOUSEHOLD_ROSTER', 'MEMBER_ROSTER'])
    .default('BARANGAY_SUMMARY'),
  barangayGeoCode: z.string().trim().default('ALL'),
  criteria: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val): ReportIndicatorId[] => {
      if (!val) return [];
      const rawList = Array.isArray(val)
        ? val.flatMap((v) => v.split(','))
        : val.split(',');
      return rawList
        .map((s) => s.trim() as ReportIndicatorId)
        .filter((s) => s.length > 0 && REPORT_INDICATOR_MAP.has(s));
    }),
  matchMode: z.enum(['all', 'any']).default('all'),
  waiverOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
  search: z.string().trim().optional().default(''),
  format: z.enum(['xlsx', 'csv']).optional().default('xlsx'),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ReportFilterQuery = z.infer<typeof ReportFilterQuerySchema>;

export interface BarangayAggregatedReportRow {
  barangayGeoCode: string;
  barangayName: string;
  totalHouseholds: number;
  totalPopulation: number;
  totalMales: number;
  totalFemales: number;
  matchingHouseholds: number;
  matchingRate: number;
  poorHouseholds: number;
  poorRate: number;
  nearPoor5Households: number;
  fourPsHouseholds: number;
  fourPsRate: number;
  no4psPoorHouseholds: number;
  outOfSchoolYouthCount: number;
  householdsWithOsy: number;
  attendingSchoolCount?: number;
  nonLiterateCount?: number;
  tvetCount?: number;
  seniorCitizensCount: number;
  householdsWithSenior: number;
  pwdCount: number;
  householdsWithPwd: number;
  soloParentCount: number;
  fisherfolkCount: number;
  farmerCount: number;
  unemployedCount: number;
  underemployedCount?: number;
  ofwCount?: number;
  foodInsecureHouseholds: number;
  unimprovedWaterHouseholds: number;
  unimprovedSanitationHouseholds: number;
  makeshiftHousingHouseholds: number;
  noElectricityHouseholds: number;
  noInternetHouseholds: number;
  disasterShockHouseholds: number;
  indicatorCounts: Record<string, number>;
}

export interface HouseholdReportRosterRow {
  id: string;
  cbmsUuid: string;
  husn: string;
  hsn: string;
  barangayGeoCode: string;
  barangayName: string;
  sitioPurok: string;
  houseNumber: string;
  headName: string;
  hhSize: number;
  males: number;
  females: number;
  longitude: number | null;
  latitude: number | null;
  waiverConsented: boolean;
  poor: boolean;
  nearPoor5: boolean;
  fourPsBeneficiary: boolean;
  electricity: boolean;
  internetAtHome: boolean;
  hasSeniorCitizen: boolean;
  hasPwd: boolean;
  hasSoloParent: boolean;
  hasOutOfSchoolYouth: boolean;
  hasFisherfolk: boolean;
  hasFarmer: boolean;
  foodInsecure: boolean;
  unimprovedWater: boolean;
  makeshiftHousing: boolean;
  disasterShock: boolean;
  matchedIndicators: ReportIndicatorId[];
}

export interface MemberReportRosterRow {
  memberId: string;
  householdId: string;
  cbmsUuid: string;
  barangayGeoCode: string;
  barangayName: string;
  sitioPurok: string;
  husn: string;
  hsn: string;
  lineNumber: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  sex: 'Male' | 'Female';
  age: number;
  relationToHead: string;
  isSeniorCitizen: boolean;
  isPwd: boolean;
  isSoloParent: boolean;
  isOutOfSchoolYouth: boolean;
  attendingSchool: boolean;
  isFisherfolk: boolean;
  isFarmer: boolean;
  isUnemployed: boolean;
  occupation: string;
  householdPoor: boolean;
  fourPsBeneficiary: boolean;
  waiverConsented: boolean;
  longitude: number | null;
  latitude: number | null;
  matchedIndicators: ReportIndicatorId[];
}

export interface ReportPreviewSummary {
  surveyYear: number;
  reportType: ReportTypeId;
  barangayGeoCode: string;
  criteria: ReportIndicatorId[];
  matchMode: ReportCriteriaMatchMode;
  waiverOnly: boolean;
  usingSampleFallback: boolean;
  totalMatchingRows: number;
  totalHouseholdsCovered: number;
  totalPopulationCovered: number;
  totalPoorHouseholds: number;
  totalFourPsHouseholds: number;
  totalOutOfSchoolYouth: number;
  totalSeniorCitizens: number;
  totalPwdMembers: number;
  prunedHouseholdTablesJoined: string[];
  prunedMemberTablesJoined: string[];
}

export interface ReportPreviewResponse {
  summary: ReportPreviewSummary;
  barangayRows?: BarangayAggregatedReportRow[];
  householdRows?: HouseholdReportRosterRow[];
  memberRows?: MemberReportRosterRow[];
}

export type UploadBatchStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK';

export interface EtlValidationWarning {
  rowNumber?: number;
  cbmsUuid?: string;
  code: string;
  message: string;
}

export interface UploadBatchSummary {
  id: string;
  surveyYearId: number;
  surveyYear: number;
  surveyTitle: string;
  uploadedBy: string | null;
  fileName: string;
  fileType: 'XLSX' | 'XLS' | 'CSV';
  fileSizeBytes: number | null;
  status: UploadBatchStatus;
  totalRowsRead: number;
  householdsImported: number;
  membersImported: number;
  errorLog: EtlValidationWarning[];
  uploadedAt: string;
  completedAt: string | null;
}

export interface SurveyYearSummary {
  id: number;
  surveyYear: number;
  title: string;
  referenceDate: string | null;
  psaApprovalNo: string | null;
  isActive: boolean;
  householdCount: number;
  memberCount: number;
}
