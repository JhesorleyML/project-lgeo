import type { ColumnType, Generated } from 'kysely';
import type { UserRole } from '@cbms/shared';

export interface UsersTable {
  id: Generated<string>;
  email: string;
  full_name: string;
  password_hash: string;
  role: UserRole;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface SurveyYearsTable {
  id: Generated<number>;
  survey_year: number;
  title: string;
  reference_date: string | null;
  psa_approval_no: string | null;
  description: string | null;
  is_active: Generated<boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface UploadBatchesTable {
  id: Generated<string>;
  survey_year_id: number;
  uploaded_by: string | null;
  file_name: string;
  file_type: 'XLSX' | 'XLS' | 'CSV';
  file_size_bytes: number | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  total_rows_read: Generated<number>;
  households_imported: Generated<number>;
  members_imported: Generated<number>;
  error_log: unknown;
  uploaded_at: ColumnType<Date, string | undefined, never>;
  completed_at: Date | null;
}

export interface BarangaysTable {
  barangay_geo_code: string;
  city_mun_geo_code: string;
  barangay_code: string;
  name: string;
  geom_boundary: unknown | null;
}

export interface LandUseZonesTable {
  id: Generated<number>;
  source_id: number | null;
  city_mun_geo_code: string;
  lu_name: string;
  lu_category: string;
  area_hectares: number;
  perimeter_length: number;
  geom_boundary: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface MunicipalLandmarksTable {
  id: Generated<number>;
  source_id: number | null;
  city_mun_geo_code: string;
  barangay_geo_code: string | null;
  barangay_name: string | null;
  name: string;
  landmark_type: string;
  sector_category: string;
  longitude: number;
  latitude: number;
  geom_point: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface RoadNetworksTable {
  id: Generated<number>;
  source_id: number | null;
  city_mun_geo_code: string;
  barangay_name: string | null;
  road_name: string;
  road_class: string;
  surface_type: string;
  road_condition: string;
  width_meters: number | null;
  raw_length: number | null;
  length_meters: number;
  buffer_meters: number | null;
  remarks: string | null;
  geom_line: unknown;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface HouseholdsTable {
  id: Generated<string>;
  survey_year_id: number;
  upload_batch_id: string | null;
  cbms_uuid: string;
  map_uuid: string | null;
  city_mun_geo_code: string;
  barangay_geo_code: string;
  city_mun_name: string | null;
  barangay_name: string | null;
  husn: string | null;
  hsn: string | null;
  longitude: number | null;
  latitude: number | null;
  geom_point: unknown | null;
  hh_size: number | null;
  number_of_males: number | null;
  number_of_females: number | null;
  agree_to_sign_the_waiver: number | null;
  address_sitio_purok: string | null;
}

export interface HouseholdPovertyTable {
  household_id: string;
  poor: number | null;
  near_poor_5_pct: number | null;
  near_poor_10_pct: number | null;
  near_poor_15_pct: number | null;
  near_poor_20_pct: number | null;
  near_poor_25_pct: number | null;
}

export interface MvBarangayYearlyIndicatorsView {
  survey_year_id: number;
  survey_year: number;
  barangay_geo_code: string;
  barangay_name: string;
  city_mun_geo_code: string;
  city_mun_name: string;
  total_households: number;
  total_population: number;
  total_males: number;
  total_females: number;
  poor_households: number;
  near_poor_5_households: number;
  near_poor_10_households: number;
  near_poor_15_households: number;
  near_poor_20_households: number;
  near_poor_25_households: number;
  households_with_electricity: number;
  households_with_home_internet: number;
  households_4ps_beneficiaries: number;
  geom_boundary: unknown | null;
}

export interface Database {
  users: UsersTable;
  survey_years: SurveyYearsTable;
  upload_batches: UploadBatchesTable;
  barangays: BarangaysTable;
  land_use_zones: LandUseZonesTable;
  municipal_landmarks: MunicipalLandmarksTable;
  road_networks: RoadNetworksTable;
  households: HouseholdsTable;
  household_poverty: HouseholdPovertyTable;
  mv_barangay_yearly_indicators: MvBarangayYearlyIndicatorsView;
}
