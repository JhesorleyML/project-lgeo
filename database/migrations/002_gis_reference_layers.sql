-- ============================================================================
-- CBMS Web-GIS System - Municipal GIS Reference Layers Migration
-- Migration: 002_gis_reference_layers.sql
-- Description:
--   Idempotently creates the PostGIS reference tables for Existing Land Use
--   (land_use_zones), Municipal Landmarks/Facilities (municipal_landmarks),
--   and Municipal Road Networks (road_networks) in EPSG:4326 with GiST indexes.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.land_use_zones (
    id SERIAL PRIMARY KEY,
    source_id INT UNIQUE,
    city_mun_geo_code VARCHAR(15) NOT NULL REFERENCES public.cities_municipalities(city_mun_geo_code) ON DELETE CASCADE,
    lu_name VARCHAR(150) NOT NULL,
    lu_category VARCHAR(150) NOT NULL,
    area_hectares DOUBLE PRECISION NOT NULL DEFAULT 0,
    perimeter_length DOUBLE PRECISION NOT NULL DEFAULT 0,
    geom_boundary GEOMETRY(MultiPolygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_land_use_zones_city_mun ON public.land_use_zones(city_mun_geo_code);
CREATE INDEX IF NOT EXISTS idx_land_use_zones_category ON public.land_use_zones(lu_category);
CREATE INDEX IF NOT EXISTS idx_land_use_zones_geom ON public.land_use_zones USING GIST (geom_boundary);

CREATE TABLE IF NOT EXISTS public.municipal_landmarks (
    id SERIAL PRIMARY KEY,
    source_id INT UNIQUE,
    city_mun_geo_code VARCHAR(15) NOT NULL REFERENCES public.cities_municipalities(city_mun_geo_code) ON DELETE CASCADE,
    barangay_geo_code VARCHAR(20) REFERENCES public.barangays(barangay_geo_code) ON DELETE SET NULL,
    barangay_name VARCHAR(150),
    name VARCHAR(200) NOT NULL,
    landmark_type VARCHAR(100) NOT NULL,
    sector_category VARCHAR(50) NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    geom_point GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_municipal_landmarks_city_mun ON public.municipal_landmarks(city_mun_geo_code);
CREATE INDEX IF NOT EXISTS idx_municipal_landmarks_brgy ON public.municipal_landmarks(barangay_geo_code);
CREATE INDEX IF NOT EXISTS idx_municipal_landmarks_sector ON public.municipal_landmarks(sector_category, landmark_type);
CREATE INDEX IF NOT EXISTS idx_municipal_landmarks_geom ON public.municipal_landmarks USING GIST (geom_point);

CREATE TABLE IF NOT EXISTS public.road_networks (
    id SERIAL PRIMARY KEY,
    source_id INT UNIQUE,
    city_mun_geo_code VARCHAR(15) NOT NULL REFERENCES public.cities_municipalities(city_mun_geo_code) ON DELETE CASCADE,
    barangay_name VARCHAR(150),
    road_name VARCHAR(200) NOT NULL,
    road_class VARCHAR(50) NOT NULL,
    surface_type VARCHAR(50) NOT NULL,
    road_condition VARCHAR(50) NOT NULL,
    width_meters DOUBLE PRECISION,
    raw_length DOUBLE PRECISION,
    length_meters DOUBLE PRECISION NOT NULL DEFAULT 0,
    buffer_meters INT,
    remarks TEXT,
    geom_line GEOMETRY(MultiLineString, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_road_networks_city_mun ON public.road_networks(city_mun_geo_code);
CREATE INDEX IF NOT EXISTS idx_road_networks_class_cond ON public.road_networks(road_class, road_condition, surface_type);
CREATE INDEX IF NOT EXISTS idx_road_networks_geom ON public.road_networks USING GIST (geom_line);

COMMIT;
