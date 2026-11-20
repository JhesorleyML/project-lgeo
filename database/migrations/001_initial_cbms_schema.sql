-- ============================================================================
-- CBMS Web-GIS System - Initial PostgreSQL + PostGIS Database Schema
-- Migration: 001_initial_cbms_schema.sql
-- Description:
--   Domain-Modular Normalized Schema supporting Multi-Year CBMS Survey Uploads
--   (Excel/CSV), PSGC Administrative Hierarchy, PostGIS Spatial Geometries,
--   and all 312 CBMS Columns (Sections A-E for Members, Sections F-O + Poverty
--   for Households).
-- ============================================================================

BEGIN;

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- PART 1: USERS, MULTI-YEAR SURVEY MANAGEMENT & UPLOAD BATCHES
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'STAFF' CHECK (role IN ('ADMIN', 'MUNICIPAL_STATISTICIAN', 'MPDC', 'STAFF')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE survey_years (
    id SERIAL PRIMARY KEY,
    survey_year SMALLINT NOT NULL UNIQUE CHECK (survey_year >= 2000 AND survey_year <= 2100),
    title VARCHAR(150) NOT NULL,               -- e.g., '2024 POPCEN-CBMS'
    reference_date DATE,                       -- e.g., '2024-07-01'
    psa_approval_no VARCHAR(50),               -- e.g., 'PSA-2419-02-001'
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE upload_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_year_id INT NOT NULL REFERENCES survey_years(id) ON DELETE RESTRICT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('XLSX', 'XLS', 'CSV')),
    file_size_bytes BIGINT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK')),
    total_rows_read INT NOT NULL DEFAULT 0,
    households_imported INT NOT NULL DEFAULT 0,
    members_imported INT NOT NULL DEFAULT 0,
    error_log JSONB DEFAULT '[]'::jsonb,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_upload_batches_survey_year ON upload_batches(survey_year_id);

-- ============================================================================
-- PART 2: GEOGRAPHIC / ADMINISTRATIVE HIERARCHY (PSGC + PostGIS Boundaries)
-- Maps Columns 1-4, 6-9, and 108-111 from CBMS_Columns.xlsx
-- ============================================================================

CREATE TABLE regions (
    region_code VARCHAR(10) PRIMARY KEY,       -- Col 6: region_code (e.g., '16')
    name VARCHAR(150),
    geom_boundary GEOMETRY(MultiPolygon, 4326)
);

CREATE TABLE provinces (
    province_geo_code VARCHAR(15) PRIMARY KEY, -- Composite region_code + province_code (e.g., '16085')
    region_code VARCHAR(10) NOT NULL REFERENCES regions(region_code) ON DELETE RESTRICT,
    province_code VARCHAR(10) NOT NULL,        -- Col 7: province_code (e.g., '085')
    name VARCHAR(150),
    geom_boundary GEOMETRY(MultiPolygon, 4326)
);

CREATE TABLE cities_municipalities (
    city_mun_geo_code VARCHAR(15) PRIMARY KEY, -- Col 1 / 108: city_mun_geo_code.x / .y (e.g., '1608506')
    province_geo_code VARCHAR(15) REFERENCES provinces(province_geo_code) ON DELETE RESTRICT,
    region_code VARCHAR(10) NOT NULL,          -- Col 6: region_code (e.g., '16')
    province_code VARCHAR(10) NOT NULL,        -- Col 7: province_code (e.g., '085')
    city_mun_code VARCHAR(10) NOT NULL,        -- Col 8: city_mun_code (e.g., '06')
    name VARCHAR(150) NOT NULL,                -- Col 3 / 110: city_mun.x / .y (e.g., 'San Jose, Dinagat Islands')
    geom_boundary GEOMETRY(MultiPolygon, 4326)
);

CREATE TABLE barangays (
    barangay_geo_code VARCHAR(20) PRIMARY KEY, -- Col 2 / 109: barangay_geo_code.x / .y (e.g., '1608506001')
    city_mun_geo_code VARCHAR(15) NOT NULL REFERENCES cities_municipalities(city_mun_geo_code) ON DELETE RESTRICT,
    barangay_code VARCHAR(10) NOT NULL,        -- Col 9: barangay_code (e.g., '001')
    name VARCHAR(150) NOT NULL,                -- Col 4 / 111: barangay.x / .y (e.g., 'Aurelio')
    geom_boundary GEOMETRY(MultiPolygon, 4326)
);

CREATE INDEX idx_regions_geom ON regions USING GIST (geom_boundary);
CREATE INDEX idx_provinces_geom ON provinces USING GIST (geom_boundary);
CREATE INDEX idx_cities_mun_geom ON cities_municipalities USING GIST (geom_boundary);
CREATE INDEX idx_barangays_geom ON barangays USING GIST (geom_boundary);
CREATE INDEX idx_barangays_city_mun ON barangays(city_mun_geo_code);

-- ============================================================================
-- PART 2B: MUNICIPAL PHYSICAL & INFRASTRUCTURE REFERENCE LAYERS (PostGIS)
-- Existing Land Use (ELU), Municipal Landmarks/Facilities, and Road Networks
-- ============================================================================

CREATE TABLE land_use_zones (
    id SERIAL PRIMARY KEY,
    source_id INT UNIQUE,
    city_mun_geo_code VARCHAR(15) NOT NULL REFERENCES cities_municipalities(city_mun_geo_code) ON DELETE CASCADE,
    lu_name VARCHAR(150) NOT NULL,             -- e.g., 'Residential', 'Commercial', 'Mangrove', 'Agricultural Land'
    lu_category VARCHAR(150) NOT NULL,         -- e.g., 'Residential', 'Forestland', 'Water (Protection)'
    area_hectares DOUBLE PRECISION NOT NULL DEFAULT 0,
    perimeter_length DOUBLE PRECISION NOT NULL DEFAULT 0,
    geom_boundary GEOMETRY(MultiPolygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_land_use_zones_city_mun ON land_use_zones(city_mun_geo_code);
CREATE INDEX idx_land_use_zones_category ON land_use_zones(lu_category);
CREATE INDEX idx_land_use_zones_geom ON land_use_zones USING GIST (geom_boundary);

CREATE TABLE municipal_landmarks (
    id SERIAL PRIMARY KEY,
    source_id INT UNIQUE,
    city_mun_geo_code VARCHAR(15) NOT NULL REFERENCES cities_municipalities(city_mun_geo_code) ON DELETE CASCADE,
    barangay_geo_code VARCHAR(20) REFERENCES barangays(barangay_geo_code) ON DELETE SET NULL,
    barangay_name VARCHAR(150),
    name VARCHAR(200) NOT NULL,                -- Specific facility description (LNDMK_DESC)
    landmark_type VARCHAR(100) NOT NULL,       -- Normalized facility type (School, Health Station, Barangay Hall, etc.)
    sector_category VARCHAR(50) NOT NULL,      -- HEALTH_WELFARE, DRRM_EVACUATION, EDUCATION, GOVERNANCE, TRANSPORT_LIFELINES, COMMERCE_ENVIRONMENT
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    geom_point GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_municipal_landmarks_city_mun ON municipal_landmarks(city_mun_geo_code);
CREATE INDEX idx_municipal_landmarks_brgy ON municipal_landmarks(barangay_geo_code);
CREATE INDEX idx_municipal_landmarks_sector ON municipal_landmarks(sector_category, landmark_type);
CREATE INDEX idx_municipal_landmarks_geom ON municipal_landmarks USING GIST (geom_point);

CREATE TABLE road_networks (
    id SERIAL PRIMARY KEY,
    source_id INT UNIQUE,
    city_mun_geo_code VARCHAR(15) NOT NULL REFERENCES cities_municipalities(city_mun_geo_code) ON DELETE CASCADE,
    barangay_name VARCHAR(150),
    road_name VARCHAR(200) NOT NULL,
    road_class VARCHAR(50) NOT NULL,           -- National, Provincial, Municipal, Barangay, Stairway
    surface_type VARCHAR(50) NOT NULL,         -- Concrete, Gravel, Earth
    road_condition VARCHAR(50) NOT NULL,       -- Good, Fair, Passable, Poor, Bad
    width_meters DOUBLE PRECISION,
    raw_length DOUBLE PRECISION,
    length_meters DOUBLE PRECISION NOT NULL DEFAULT 0, -- Spheroidal length via ST_Length(geom::geography)
    buffer_meters INT,
    remarks TEXT,
    geom_line GEOMETRY(MultiLineString, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_road_networks_city_mun ON road_networks(city_mun_geo_code);
CREATE INDEX idx_road_networks_class_cond ON road_networks(road_class, road_condition, surface_type);
CREATE INDEX idx_road_networks_geom ON road_networks USING GIST (geom_line);

-- ============================================================================
-- PART 3: CORE HOUSEHOLDS & HOUSEHOLD MEMBERS TABLES
-- Maps Columns 0-11 and 108-132 from CBMS_Columns.xlsx
-- ============================================================================

CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_year_id INT NOT NULL REFERENCES survey_years(id) ON DELETE CASCADE,
    upload_batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,

    -- CBMS Native Identifiers
    cbms_uuid UUID NOT NULL,                               -- Col 0: uuid (Household UUID shared by members)
    map_uuid UUID,                                         -- Col 112: map_uuid

    -- Geographic Identification (.x and .y preserved)
    city_mun_geo_code VARCHAR(15) NOT NULL REFERENCES cities_municipalities(city_mun_geo_code), -- Col 1/108
    barangay_geo_code VARCHAR(20) NOT NULL REFERENCES barangays(barangay_geo_code),             -- Col 2/109
    city_mun_name VARCHAR(150),                            -- Col 3/110: city_mun.x / city_mun.y
    barangay_name VARCHAR(150),                            -- Col 4/111: barangay.x / barangay.y
    region_code VARCHAR(10),                               -- Col 6: region_code
    province_code VARCHAR(10),                             -- Col 7: province_code
    city_mun_code VARCHAR(10),                             -- Col 8: city_mun_code
    barangay_code VARCHAR(10),                             -- Col 9: barangay_code

    -- Serial Numbers
    husn VARCHAR(20),                                      -- Col 10 / 113: husn.x / husn.y (Housing Unit Serial Number)
    hsn VARCHAR(20),                                       -- Col 11 / 114: hsn.x / hsn.y (Household Serial Number)

    -- Spatial Coordinates & PostGIS Point Geometry
    longitude DOUBLE PRECISION,                            -- Col 115: longitude
    latitude DOUBLE PRECISION,                             -- Col 116: latitude
    geom_point GEOMETRY(Point, 4326),                      -- Auto-populated from (longitude, latitude)

    -- Summary of Visit & Household Counts
    hh_size SMALLINT,                                      -- Col 117: hh_size
    number_of_males SMALLINT,                              -- Col 118: number_of_males
    number_of_females SMALLINT,                            -- Col 119: number_of_females
    number_of_nuclear_families SMALLINT,                   -- Col 120: number_of_nuclear_families
    respondent_line_number VARCHAR(10),                    -- Col 121: respondent_line_number

    -- CBMS Form 3 Consent / Waiver
    agree_to_sign_the_waiver SMALLINT,                     -- Col 122: agree_to_sign_the_waiver (1=Yes, 2=No)
    reason_for_not_signing_the_waiver SMALLINT,            -- Col 123: reason_for_not_signing_the_waiver

    -- Household Address & Spatial Proximity
    address_house_number VARCHAR(100),                     -- Col 124: address_house_number
    address_floor_number VARCHAR(50),                      -- Col 125: address_floor_number
    address_block_or_lot_number VARCHAR(100),              -- Col 126: address_block_or_lot_number
    address_street_name VARCHAR(150),                      -- Col 127: address_street_name
    address_subdivision_or_village VARCHAR(150),           -- Col 128: address_subdivision_or_village
    address_sitio_purok VARCHAR(150),                      -- Col 129: address_sitio_purok
    proximity_health_center DOUBLE PRECISION,              -- Col 130: proximity_health_center
    proximity_hospital DOUBLE PRECISION,                   -- Col 131: proximity_hospital
    overcrowding_status SMALLINT,                          -- Col 132: overcrowding_status

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensures independent survey snapshots per year while preventing duplicate households within the same year
    CONSTRAINT uq_households_year_cbms_uuid UNIQUE (survey_year_id, cbms_uuid)
);

-- Trigger Function to automatically synchronize geom_point from longitude and latitude
CREATE OR REPLACE FUNCTION fn_sync_household_geom_point()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.longitude IS NOT NULL AND NEW.latitude IS NOT NULL THEN
        NEW.geom_point := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    ELSE
        NEW.geom_point := NULL;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_household_geom_point
BEFORE INSERT OR UPDATE OF longitude, latitude ON households
FOR EACH ROW EXECUTE FUNCTION fn_sync_household_geom_point();

CREATE INDEX idx_households_geom ON households USING GIST (geom_point);
CREATE INDEX idx_households_year_brgy ON households(survey_year_id, barangay_geo_code);
CREATE INDEX idx_households_year_city ON households(survey_year_id, city_mun_geo_code);
CREATE INDEX idx_households_cbms_uuid ON households(cbms_uuid);
CREATE INDEX idx_households_map_uuid ON households(map_uuid);

-- Core Household Members Table
CREATE TABLE household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    survey_year_id INT NOT NULL REFERENCES survey_years(id) ON DELETE CASCADE,
    line_number VARCHAR(10) NOT NULL,                      -- Col 5: line_number (e.g., '01', '02')
    city_mun_geo_code_x VARCHAR(15),                       -- Col 1: city_mun_geo_code.x
    barangay_geo_code_x VARCHAR(20),                       -- Col 2: barangay_geo_code.x
    city_mun_x VARCHAR(150),                               -- Col 3: city_mun.x
    barangay_x VARCHAR(150),                               -- Col 4: barangay.x
    husn_x VARCHAR(20),                                    -- Col 10: husn.x
    hsn_x VARCHAR(20),                                     -- Col 11: hsn.x
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_member_household_line UNIQUE (household_id, line_number)
);

CREATE INDEX idx_members_household_id ON household_members(household_id);
CREATE INDEX idx_members_survey_year ON household_members(survey_year_id);

-- ============================================================================
-- PART 4: MEMBER-LEVEL DOMAIN TABLES (SECTIONS A TO E, COLUMNS 12 TO 107)
-- ============================================================================

-- Section A: Core Demographic Characteristics (Columns 12 to 30)
CREATE TABLE member_demographics_core (
    member_id UUID PRIMARY KEY REFERENCES household_members(id) ON DELETE CASCADE,
    a01_last_name VARCHAR(100),                            -- Col 12
    a01_first_name VARCHAR(100),                           -- Col 13
    a01_suffix VARCHAR(30),                                -- Col 14
    a01_middle_name VARCHAR(100),                          -- Col 15
    a02_relation_to_hh_head SMALLINT,                      -- Col 16 (Codes 01-26)
    a03_sex SMALLINT,                                      -- Col 17 (1=Male, 2=Female)
    a04_birthday_month SMALLINT,                           -- Col 18 (1-12)
    a04_birthday_day SMALLINT,                             -- Col 19 (1-31)
    a04_birthday_year SMALLINT,                            -- Col 20 (YYYY)
    a05_age SMALLINT,                                      -- Col 21
    a05_age_group_five_years SMALLINT,                     -- Col 22
    a06_lcr_reg_status SMALLINT,                           -- Col 23 (1=Yes, 2=No, 8=DK)
    a07_marital_status SMALLINT,                           -- Col 24 (1=Single..8=Not reported)
    a08_religion INT,                                      -- Col 25
    a09_ethnicity INT,                                     -- Col 26
    a10_simple_literacy SMALLINT,                          -- Col 27 (1=Yes, 2=No)
    a11_hgc_level SMALLINT,                                -- Col 28 (Level 0-8)
    a11_hgc_group INT,                                     -- Col 29
    a11_hgc INT                                            -- Col 30 (8-digit PSA HGC code)
);

CREATE INDEX idx_mem_demo_core_sex_age ON member_demographics_core(a03_sex, a05_age);

-- Section B: Other Demographic Characteristics (Columns 31 to 57)
CREATE TABLE member_demographics_other (
    member_id UUID PRIMARY KEY REFERENCES household_members(id) ON DELETE CASCADE,
    b01_nuclear_family SMALLINT,                           -- Col 31
    b02_relation_to_nuclear_family_head SMALLINT,          -- Col 32 (Codes 00-10)
    b03_phil_id SMALLINT,                                  -- Col 33 (1=Yes, 2=No, 8=DK)
    b05_solo_parent SMALLINT,                              -- Col 34 (1=Yes, 2=No, 8=DK)
    b06_solo_parent_id SMALLINT,                           -- Col 35
    b07_senior_citizen_id SMALLINT,                        -- Col 36
    b08_currently_pregnant SMALLINT,                       -- Col 37
    b09_lactating_mother SMALLINT,                         -- Col 38
    b10_pwd SMALLINT,                                      -- Col 39
    b11_with_pwd_id SMALLINT,                              -- Col 40
    b12_a_visual_disability SMALLINT,                      -- Col 41
    b12_b_hearing_disability SMALLINT,                     -- Col 42
    b12_c_mental_disability SMALLINT,                      -- Col 43
    b12_d_physical_disability SMALLINT,                    -- Col 44
    b12_e_speech_impairment SMALLINT,                      -- Col 45
    b12_f_cancer SMALLINT,                                 -- Col 46
    b12_g_rare_disease SMALLINT,                           -- Col 47
    b12_z_other_disability SMALLINT,                       -- Col 48
    b13_seeing SMALLINT,                                   -- Col 49 (1=No difficulty..4=Cannot do at all)
    b14_hearing SMALLINT,                                  -- Col 50
    b15_walking SMALLINT,                                  -- Col 51
    b16_remembering SMALLINT,                              -- Col 52
    b17_self_caring SMALLINT,                              -- Col 53
    b18_communicating SMALLINT,                            -- Col 54
    b19_ssdi SMALLINT,                                     -- Col 55
    b20_sssco SMALLINT,                                    -- Col 56
    b21_sssc SMALLINT                                      -- Col 57
);

CREATE INDEX idx_mem_demo_other_pwd_senior ON member_demographics_other(b10_pwd, b07_senior_citizen_id, b05_solo_parent);

-- Section C: Migration (Columns 58 to 69)
CREATE TABLE member_migration (
    member_id UUID PRIMARY KEY REFERENCES household_members(id) ON DELETE CASCADE,
    c01_citizenship SMALLINT,                              -- Col 58 (1=Filipino..8=DK)
    c02_ofi SMALLINT,                                      -- Col 59 (1=OFW w/ contract..6=Resident PH)
    c03_ever_experienced_migration SMALLINT,               -- Col 60 (1=Yes, 2=No, 8=DK)
    c04_migration_level SMALLINT,                          -- Col 61
    c04_recent_migration_region VARCHAR(30),               -- Col 62
    c04_recent_migration_province VARCHAR(30),             -- Col 63
    c04_recent_migration_city_mun VARCHAR(30),             -- Col 64
    c04_recent_migration_barangay VARCHAR(30),             -- Col 65
    c04_recent_migration_country VARCHAR(30),              -- Col 66
    c05_date_of_movement_month SMALLINT,                   -- Col 67
    c05_date_of_movement_year SMALLINT,                    -- Col 68
    c06_internal_displacement SMALLINT                     -- Col 69 (1=No, 2=Natural calamities..8=DK)
);

-- Section D: Education (Columns 70 to 83)
CREATE TABLE member_education (
    member_id UUID PRIMARY KEY REFERENCES household_members(id) ON DELETE CASCADE,
    d01_currently_attending_school SMALLINT,               -- Col 70 (1=Yes, 2=No)
    d02_type_of_school_attended SMALLINT,                  -- Col 71 (1=Public, 2=Private)
    d03_current_grade_level SMALLINT,                      -- Col 72
    d03_current_grade INT,                                 -- Col 73 (8-digit PSA Grade Code)
    d04_a_impact SMALLINT,                                 -- Col 74
    d04_b_home_school SMALLINT,                            -- Col 75
    d04_c_misosa SMALLINT,                                 -- Col 76
    d04_d_night_high_school SMALLINT,                      -- Col 77
    d04_e_open_high_school SMALLINT,                       -- Col 78
    d04_f_rural_farm_school SMALLINT,                      -- Col 79
    d05_madrasah_program SMALLINT,                         -- Col 80 (1=Yes, 2=No)
    d06_reason_not_attending_school SMALLINT,              -- Col 81 (Codes 01-18, 99)
    d07_tvet_graduate SMALLINT,                            -- Col 82 (1=Yes, 2=No)
    d08_tvet_currently_attending SMALLINT                  -- Col 83 (1=Yes, 2=No)
);

CREATE INDEX idx_mem_education_school ON member_education(d01_currently_attending_school, d02_type_of_school_attended);

-- Section E: Economic Characteristics (Columns 84 to 107)
CREATE TABLE member_economics (
    member_id UUID PRIMARY KEY REFERENCES household_members(id) ON DELETE CASCADE,
    e01_labor_force_participation SMALLINT,                -- Col 84
    e01_employment_status SMALLINT,                        -- Col 85
    e01_underemployment_status SMALLINT,                   -- Col 86
    e01_discouraged_worker SMALLINT,                       -- Col 87
    e01_work_past_week SMALLINT,                           -- Col 88 (1=Yes, 2=No)
    e02_job_or_business_past_week SMALLINT,                -- Col 89 (1=Yes, 2=No, 3=No temporarily)
    e03_work_location_province VARCHAR(30),                -- Col 90
    e04_work_location_city_mun VARCHAR(30),                -- Col 91
    e05_psoc INT,                                          -- Col 92 (6-digit PSOC occupation code)
    e05_occupation_group SMALLINT,                         -- Col 93
    e06_psic INT,                                          -- Col 94 (5-digit PSIC industry code)
    e06_industry_group SMALLINT,                           -- Col 95
    e07_nature_of_employment SMALLINT,                     -- Col 96 (1=Permanent, 2=Short-term, 3=Day-to-day)
    e08_class_of_worker SMALLINT,                          -- Col 97 (Codes 0-6)
    e09_basis_of_payment SMALLINT,                         -- Col 98 (Codes 0-7)
    e10_other_job_or_business_past_week SMALLINT,          -- Col 99 (1=Yes, 2=No)
    e11_number_of_hours_worked_in_all_jobs SMALLINT,       -- Col 100
    e12_want_more_hours SMALLINT,                          -- Col 101 (1=Yes, 2=No)
    e13_try_look_for_work SMALLINT,                        -- Col 102 (1=Yes, 2=No)
    e14_reason_not_looking_for_work SMALLINT,              -- Col 103 (Codes 01-10, 99)
    e15_available_for_work SMALLINT,                       -- Col 104 (1=Yes, 2=No)
    e16_willing_to_work SMALLINT,                          -- Col 105 (1=Yes, 2=No)
    e17_farmer SMALLINT,                                   -- Col 106 (1=Yes, 2=No)
    e18_fisherfolk SMALLINT                                -- Col 107 (1=Yes, 2=No)
);

CREATE INDEX idx_mem_econ_status ON member_economics(e01_labor_force_participation, e01_employment_status, e17_farmer, e18_fisherfolk);

-- ============================================================================
-- PART 5: HOUSEHOLD-LEVEL DOMAIN TABLES (SECTIONS F TO O + POVERTY, COLS 133-311)
-- ============================================================================

-- Section F: Health Characteristics (Columns 133 to 159)
CREATE TABLE household_health (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    f01_with_member_who_has_been_sick SMALLINT,            -- Col 133 (1=Yes, 2=No)
    f02_availed_medical_treatment SMALLINT,                -- Col 134 (1=Yes, 2=No)
    f03_a_public_regional_hospital SMALLINT,               -- Col 135
    f03_b_public_provincial_hospital SMALLINT,             -- Col 136
    f03_c_public_district_hospital SMALLINT,               -- Col 137
    f03_d_public_municipal_hospital SMALLINT,              -- Col 138
    f03_e_public_rhu_uhc_lying_in_clinic SMALLINT,         -- Col 139
    f03_f_public_barangay_health_center SMALLINT,          -- Col 140
    f03_g_public_mobile_clinic SMALLINT,                   -- Col 141
    f03_h_public_isolation_facility SMALLINT,              -- Col 142
    f03_i_other_public_health_facility SMALLINT,           -- Col 143
    f03_j_private_hospital SMALLINT,                       -- Col 144
    f03_k_private_lying_in_clinic SMALLINT,                -- Col 145
    f03_l_private_clinic SMALLINT,                         -- Col 146
    f03_m_private_pharmacy SMALLINT,                       -- Col 147
    f03_n_private_mobile_clinic SMALLINT,                  -- Col 148
    f03_o_private_health_facility_other SMALLINT,          -- Col 149
    f03_p_alternative_hilot_herbalists SMALLINT,           -- Col 150
    f03_q_alternative_massage_center SMALLINT,             -- Col 151
    f03_r_alternative_healing SMALLINT,                    -- Col 152
    f03_s_alternative_shop SMALLINT,                       -- Col 153
    f03_t_alternative_faith_healer SMALLINT,               -- Col 154
    f03_z_health_facility_other SMALLINT,                  -- Col 155
    f04_reason_not_availed_treatment SMALLINT,             -- Col 156 (Codes 1-6, 9)
    f05_measured_annually_during_opt_plus SMALLINT,        -- Col 157 (1=Yes, 2=No, 8=DK)
    f06_with_child_died SMALLINT,                          -- Col 158 (1=Yes, 2=No, 8=DK)
    f07_number_of_children_who_died SMALLINT               -- Col 159
);

-- Optional Child Table for Questionnaire F08 & F09 (Under-5 Mortality Details per Child)
CREATE TABLE household_under5_mortalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    child_order SMALLINT NOT NULL,                         -- Child 1, 2, 3...
    f08_age_in_months_died SMALLINT,                       -- Questionnaire F08
    f09_sex_of_deceased_child SMALLINT,                    -- Questionnaire F09 (1=Male, 2=Female)
    CONSTRAINT uq_hh_under5_child UNIQUE (household_id, child_order)
);

-- Section G: Food Security (Columns 160 to 167)
CREATE TABLE household_food_security (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    g01_worried SMALLINT,                                  -- Col 160 (1=Yes, 2=No, 8=DK, 9=Prefer not to answer)
    g02_not_eaten_healthy SMALLINT,                        -- Col 161
    g03_ate_few_food SMALLINT,                             -- Col 162
    g04_skipped_meal SMALLINT,                             -- Col 163
    g05_ate_less SMALLINT,                                 -- Col 164
    g06_ran_out_of_food SMALLINT,                          -- Col 165
    g07_hungry SMALLINT,                                   -- Col 166
    g08_not_eaten_whole_day SMALLINT                       -- Col 167
);

-- Section I: Formal Financial Accounts (Columns 169 to 176)
CREATE TABLE household_financial_accounts (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    i01_a_bank_account SMALLINT,                           -- Col 169
    i01_b_digital_bank_account SMALLINT,                   -- Col 170
    i01_c_emoney_or_cash_card SMALLINT,                    -- Col 171
    i01_d_nssla SMALLINT,                                  -- Col 172
    i01_e_account_with_coop SMALLINT,                      -- Col 173
    i01_f_microfinance SMALLINT,                           -- Col 174
    i01_g_money_remittance SMALLINT,                       -- Col 175
    i01_z_financial_account_other SMALLINT                 -- Col 176
);

-- Section J: Negative Shocks and Disaster Preparedness (Columns 177 to 199)
CREATE TABLE household_disaster_shocks (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    j01_a_typhoon SMALLINT,                                -- Col 177
    j01_b_power_outage SMALLINT,                           -- Col 178
    j01_c_drought SMALLINT,                                -- Col 179
    j01_d_rain_or_flood SMALLINT,                          -- Col 180
    j01_e_erosion_landslide SMALLINT,                      -- Col 181
    j01_f_earthquake SMALLINT,                             -- Col 182
    j01_g_volcanic_eruption SMALLINT,                      -- Col 183
    j01_h_fire SMALLINT,                                   -- Col 184
    j01_i_pests_crops SMALLINT,                            -- Col 185
    j01_j_pests_livestock SMALLINT,                        -- Col 186
    j01_k_pests_crops_losses SMALLINT,                     -- Col 187
    j01_l_crops_failed SMALLINT,                           -- Col 188
    j01_m_livestock_died SMALLINT,                         -- Col 189
    j01_n_pollution_mining SMALLINT,                       -- Col 190
    j01_o_building_collapsed SMALLINT,                     -- Col 191
    j01_p_increase_price SMALLINT,                         -- Col 192
    j01_q_political_conflict SMALLINT,                     -- Col 193
    j01_r_hh_member_death SMALLINT,                        -- Col 194
    j01_s_hh_member_illness SMALLINT,                      -- Col 195
    j01_t_no_water_supply SMALLINT,                        -- Col 196
    j01_z_disasters_other SMALLINT,                        -- Col 197
    j02_location_of_evacuation SMALLINT,                   -- Col 198 (1=Yes, 2=No)
    j03_contact_hotline SMALLINT                           -- Col 199 (1=Yes, 2=No)
);

-- Sections H, K, L: Public Transport Access, Internet Access & Public Safety (Cols 168, 200 to 206)
CREATE TABLE household_connectivity_safety (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    h01_puv_access SMALLINT,                               -- Col 168 (1=Yes within 500m, 2=No)
    k01_internet_access SMALLINT,                          -- Col 200 (1=Yes, 2=No)
    k02_internet_at_home SMALLINT,                         -- Col 201 (1=Yes, 2=No)
    k03_a_wired_broadband SMALLINT,                        -- Col 202
    k03_b_wireless_broadband SMALLINT,                     -- Col 203
    k03_c_satellite_broadband SMALLINT,                    -- Col 204
    k03_d_mobile_broadband SMALLINT,                       -- Col 205
    l01_safe_walking_alone SMALLINT                        -- Col 206 (1=Very safe..4=Very unsafe, 5=N/A, 8=DK)
);

-- Section M: Social Protection and Assistance Programs (Columns 207 to 232)
CREATE TABLE household_social_protection (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    m01_a_sss SMALLINT,                                    -- Col 207
    m01_b_gsis SMALLINT,                                   -- Col 208
    m01_c_philhealth SMALLINT,                             -- Col 209
    m01_d_health_insurance SMALLINT,                       -- Col 210
    m02_a_benefit_sss SMALLINT,                            -- Col 211
    m02_b_benefit_gsis SMALLINT,                           -- Col 212
    m02_c_benefit_philhealth SMALLINT,                     -- Col 213
    m02_d_benefit_health_insurance SMALLINT,               -- Col 214
    m03_offer_health_medical_assistance SMALLINT,          -- Col 215
    m04_benefit_health_medical_assistance SMALLINT,        -- Col 216
    m05_a_4ps SMALLINT,                                    -- Col 217
    m05_b_socpen SMALLINT,                                 -- Col 218
    m05_c_aics SMALLINT,                                   -- Col 219
    m05_d_food_stamp SMALLINT,                             -- Col 220
    m05_e_educ_assistance SMALLINT,                        -- Col 221
    m05_f_employ_assistance SMALLINT,                      -- Col 222
    m05_g_lgu_assistance SMALLINT,                         -- Col 223
    m05_z_assistance_other SMALLINT,                       -- Col 224
    m06_a_benefit_4ps SMALLINT,                            -- Col 225
    m06_b_benefit_socpen SMALLINT,                         -- Col 226
    m06_c_benefit_aics SMALLINT,                           -- Col 227
    m06_d_benefit_food_stamp SMALLINT,                     -- Col 228
    m06_e_benefit_educ_assistance SMALLINT,                -- Col 229
    m06_f_benefit_employ_assistance SMALLINT,              -- Col 230
    m06_g_benefit_lgu_assistance SMALLINT,                 -- Col 231
    m06_z_benefit_assistance_other SMALLINT                -- Col 232
);

-- Section N: Water, Sanitation, and Hygiene / WASH (Columns 233 to 264)
CREATE TABLE household_wash (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    n01_main_water SMALLINT,                               -- Col 233
    n02_drinking_water SMALLINT,                           -- Col 234
    n03_service_level_drinking_water SMALLINT,             -- Col 235
    n03_water_for_other_purposes SMALLINT,                 -- Col 236
    n04_water_source_location SMALLINT,                    -- Col 237 (1=In dwelling, 2=In yard, 3=Elsewhere)
    n05_time_to_collect_water SMALLINT,                    -- Col 238 (Minutes)
    n05_time_to_obtain_drinking_water SMALLINT,            -- Col 239
    n06_who_fetches_water VARCHAR(50),                     -- Col 240
    n07_drinking_water_source_distance SMALLINT,           -- Col 241 (Meters)
    n08_toilet_facility SMALLINT,                          -- Col 242
    n08_service_level_toilet_facility SMALLINT,            -- Col 243
    n09_toilet_facility_located SMALLINT,                  -- Col 244 (1=In dwelling, 2=In yard, 3=Elsewhere)
    n10_share_toilet SMALLINT,                             -- Col 245 (1=Yes, 2=No)
    n11_toilet_for_public_use SMALLINT,                    -- Col 246 (1=Known HH, 2=General public)
    n12_a_segregating_waste SMALLINT,                      -- Col 247
    n12_b_garbage_truck SMALLINT,                          -- Col 248
    n12_c_recycling_at_home SMALLINT,                      -- Col 249
    n12_d_selling_away_recyclables SMALLINT,               -- Col 250
    n12_e_composting SMALLINT,                             -- Col 251
    n12_f_burning SMALLINT,                                -- Col 252
    n12_g_dumping_in_pit_with_cover SMALLINT,              -- Col 253
    n12_h_dumping_in_pit_without_cover SMALLINT,           -- Col 254
    n12_i_throwing_in_unhabited_locations SMALLINT,        -- Col 255
    n12_z_waste_disposal_other SMALLINT,                   -- Col 256
    n13_service_level_handwashing_facility SMALLINT,       -- Col 257
    n13_handwashing_facility SMALLINT,                     -- Col 258
    n14_handwashing_with_water SMALLINT,                   -- Col 259 (1=Available, 2=Not available)
    n15_handwashing_with_soap SMALLINT,                    -- Col 260 (1=Yes, 2=No)
    n16_a_soap SMALLINT,                                   -- Col 261
    n16_b_detergent SMALLINT,                              -- Col 262
    n16_c_ash_soil_or_sand SMALLINT,                       -- Col 263
    n16_z_soap_other SMALLINT                              -- Col 264
);

-- Section O (Part 1): Housing Characteristics (Columns 265 to 282)
CREATE TABLE household_housing (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    o01_building_type SMALLINT,                            -- Col 265 (Codes 01-10)
    o02_number_of_floors SMALLINT,                         -- Col 266
    o03_roof SMALLINT,                                     -- Col 267 (Codes 1-7, 9)
    o03_roof_strength SMALLINT,                            -- Col 268
    o04_outer_walls SMALLINT,                              -- Col 269 (Codes 01-09, 99)
    o04_outer_walls_strength SMALLINT,                     -- Col 270
    o05_floor_finishing SMALLINT,                          -- Col 271 (Codes 1-7, 9)
    o06_floor_strength SMALLINT,                           -- Col 272
    o06_floor SMALLINT,                                    -- Col 273 (Codes 1-9)
    o07_floor_area DOUBLE PRECISION,                       -- Col 274 (Sq meters)
    o07_floor_area_range SMALLINT,                         -- Col 275
    o08_number_of_bedrooms SMALLINT,                       -- Col 276
    o09_tenure SMALLINT,                                   -- Col 277 (Codes 1-7)
    o10_year_constructed SMALLINT,                         -- Col 278 (YYYY)
    o10_year_constructed_range SMALLINT,                   -- Col 279
    o11_electricity SMALLINT,                              -- Col 280 (1=Yes, 2=No)
    o12_fuel_for_lighting SMALLINT,                        -- Col 281 (Codes 1-9)
    o13_fuel_for_cooking SMALLINT                          -- Col 282 (Codes 1-6, 9)
);

-- Section O (Part 2): Household Assets, Conveniences, ICT & Vehicles (Columns 283 to 305)
CREATE TABLE household_assets (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    o14_a_refrigerator SMALLINT DEFAULT 0,                 -- Col 283
    o14_b_air_conditioner SMALLINT DEFAULT 0,              -- Col 284
    o14_c_washing_machine SMALLINT DEFAULT 0,              -- Col 285
    o14_d_stove_oven SMALLINT DEFAULT 0,                   -- Col 286
    o14_e_radio SMALLINT DEFAULT 0,                        -- Col 287
    o14_f_tv SMALLINT DEFAULT 0,                           -- Col 288
    o14_g_audio_component SMALLINT DEFAULT 0,              -- Col 289
    o14_h_telephone SMALLINT DEFAULT 0,                    -- Col 290
    o14_i_basic_cp SMALLINT DEFAULT 0,                     -- Col 291
    o14_j_modern_cp SMALLINT DEFAULT 0,                    -- Col 292
    o14_k_tablet SMALLINT DEFAULT 0,                       -- Col 293
    o14_l_computer SMALLINT DEFAULT 0,                     -- Col 294
    o14_m_car SMALLINT DEFAULT 0,                          -- Col 295
    o14_n_van SMALLINT DEFAULT 0,                          -- Col 296
    o14_o_jeep SMALLINT DEFAULT 0,                         -- Col 297
    o14_p_truck SMALLINT DEFAULT 0,                        -- Col 298
    o14_q_motorcycle SMALLINT DEFAULT 0,                   -- Col 299
    o14_r_ebike SMALLINT DEFAULT 0,                        -- Col 300
    o14_s_tricycle SMALLINT DEFAULT 0,                     -- Col 301
    o14_t_bicycle SMALLINT DEFAULT 0,                      -- Col 302
    o14_u_pedicab SMALLINT DEFAULT 0,                      -- Col 303
    o14_v_banca_motorized SMALLINT DEFAULT 0,              -- Col 304
    o14_w_banca_nonmotorized SMALLINT DEFAULT 0            -- Col 305
);

-- Poverty Level Threshold Indicators (Columns 306 to 311)
CREATE TABLE household_poverty (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    poor SMALLINT,                                         -- Col 306: POOR (0=Non-Poor, 1=Poor)
    near_poor_5_pct SMALLINT,                              -- Col 307: Near Poor (+5% above the poverty Threshold)
    near_poor_10_pct SMALLINT,                             -- Col 308: Near Poor (+10% above the poverty Threshold)
    near_poor_15_pct SMALLINT,                             -- Col 309: Near Poor (+15% above the poverty Threshold)
    near_poor_20_pct SMALLINT,                             -- Col 310: Near Poor (+20% above the poverty Threshold)
    near_poor_25_pct SMALLINT                              -- Col 311: Near Poor (+25% above the poverty Threshold)
);

CREATE INDEX idx_hh_poverty_poor ON household_poverty(poor, near_poor_5_pct, near_poor_10_pct, near_poor_15_pct, near_poor_20_pct, near_poor_25_pct);

-- ============================================================================
-- PART 6: MATERIALIZED VIEW FOR MULTI-YEAR WEB-GIS BARANGAY CHOROPLETH LAYERS
-- ============================================================================

CREATE MATERIALIZED VIEW mv_barangay_yearly_indicators AS
SELECT
    sy.id AS survey_year_id,
    sy.survey_year,
    b.barangay_geo_code,
    b.name AS barangay_name,
    b.city_mun_geo_code,
    cm.name AS city_mun_name,
    COUNT(DISTINCT h.id) AS total_households,
    COALESCE(SUM(h.hh_size), 0) AS total_population,
    COALESCE(SUM(h.number_of_males), 0) AS total_males,
    COALESCE(SUM(h.number_of_females), 0) AS total_females,
    COUNT(DISTINCT h.id) FILTER (WHERE hp.poor = 1) AS poor_households,
    COUNT(DISTINCT h.id) FILTER (WHERE hp.near_poor_5_pct = 1) AS near_poor_5_households,
    COUNT(DISTINCT h.id) FILTER (WHERE hp.near_poor_10_pct = 1) AS near_poor_10_households,
    COUNT(DISTINCT h.id) FILTER (WHERE hp.near_poor_15_pct = 1) AS near_poor_15_households,
    COUNT(DISTINCT h.id) FILTER (WHERE hp.near_poor_20_pct = 1) AS near_poor_20_households,
    COUNT(DISTINCT h.id) FILTER (WHERE hp.near_poor_25_pct = 1) AS near_poor_25_households,
    COUNT(DISTINCT h.id) FILTER (WHERE hho.o11_electricity = 1) AS households_with_electricity,
    COUNT(DISTINCT h.id) FILTER (WHERE hcs.k02_internet_at_home = 1) AS households_with_home_internet,
    COUNT(DISTINCT h.id) FILTER (WHERE hsp.m05_a_4ps = 1) AS households_4ps_beneficiaries,
    b.geom_boundary
FROM survey_years sy
CROSS JOIN barangays b
JOIN cities_municipalities cm ON cm.city_mun_geo_code = b.city_mun_geo_code
LEFT JOIN households h
    ON h.survey_year_id = sy.id
   AND h.barangay_geo_code = b.barangay_geo_code
LEFT JOIN household_poverty hp ON hp.household_id = h.id
LEFT JOIN household_housing hho ON hho.household_id = h.id
LEFT JOIN household_connectivity_safety hcs ON hcs.household_id = h.id
LEFT JOIN household_social_protection hsp ON hsp.household_id = h.id
GROUP BY
    sy.id, sy.survey_year,
    b.barangay_geo_code, b.name,
    b.city_mun_geo_code, cm.name,
    b.geom_boundary;

CREATE UNIQUE INDEX idx_mv_brgy_yearly_pk
    ON mv_barangay_yearly_indicators(survey_year_id, barangay_geo_code);
CREATE INDEX idx_mv_brgy_yearly_geom
    ON mv_barangay_yearly_indicators USING GIST (geom_boundary);

COMMIT;
