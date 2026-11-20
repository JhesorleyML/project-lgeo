import pg from 'pg';
import { env } from '../config/env.js';
import { pool } from './kysely.js';

const { Client } = pg;

interface SourceBoundaryRow {
  barangay_geo_code: string;
  city_mun_geo_code: string;
  barangay_code: string;
  name: string;
  source_parts: string;
  geom_ewkb: Buffer;
}

interface SourceEluRow {
  source_id: number;
  lu_name: string;
  lu_category: string;
  area_hectares: number;
  perimeter_length: number;
  geom_ewkb: Buffer;
}

interface SourceLandmarkRow {
  source_id: number;
  landmark_type: string;
  name: string;
  barangay_name: string | null;
  longitude: number;
  latitude: number;
  geom_ewkb: Buffer;
}

interface SourceRoadRow {
  source_id: number;
  road_name: string;
  road_class: string;
  barangay_name: string | null;
  surface_type: string;
  road_condition: string;
  width_meters: number | null;
  raw_length: number | null;
  length_meters: number;
  buffer_meters: number | null;
  remarks: string | null;
  geom_ewkb: Buffer;
}

const SAN_JOSE_CITY_MUN_GEO_CODE = '1608506';

function classifyLandmarkSector(landmarkType: string): string {
  const normalized = landmarkType.toUpperCase();
  if (
    normalized.includes('HEALTH') ||
    normalized.includes('BIRTHING') ||
    normalized.includes('DAY CARE')
  ) {
    return 'HEALTH_WELFARE';
  }
  if (
    normalized.includes('EVACUATION') ||
    normalized.includes('GYM') ||
    normalized.includes('MULTIPURPOSE') ||
    normalized.includes('FIRE') ||
    normalized.includes('POLICE')
  ) {
    return 'DRRM_EVACUATION';
  }
  if (normalized.includes('SCHOOL')) {
    return 'EDUCATION';
  }
  if (
    normalized.includes('HALL') ||
    normalized.includes('CAPITOL') ||
    normalized.includes('AGENCY') ||
    normalized.includes('DENR') ||
    normalized.includes('OFFICE')
  ) {
    return 'GOVERNANCE';
  }
  if (
    normalized.includes('BRIDGE') ||
    normalized.includes('PORT') ||
    normalized.includes('TERMINAL') ||
    normalized.includes('ELECTRIC') ||
    normalized.includes('NPC') ||
    normalized.includes('GAS REFILLING')
  ) {
    return 'TRANSPORT_LIFELINES';
  }
  return 'COMMERCE_ENVIRONMENT';
}

function normalizeLandmarkType(rawLandmark: string | null, rawDesc: string | null): string {
  const trimmed = (rawLandmark ?? '').trim();
  if (!trimmed) {
    const desc = (rawDesc ?? '').trim();
    if (desc.toUpperCase().includes('MRF')) return 'MRF / Solid Waste';
    return 'Community Landmark';
  }
  if (trimmed === 'Schools') return 'School';
  if (trimmed === 'Gym') return 'Gymnasium';
  if (trimmed === 'MRF' || trimmed === 'Solid Waste') return 'MRF / Solid Waste';
  return trimmed;
}

function normalizeEluName(rawName: string): string {
  const trimmed = rawName.trim();
  if (trimmed === 'Fish Sactuary') return 'Fish Sanctuary';
  if (trimmed === 'Warf/Port') return 'Wharf/Port';
  return trimmed;
}

async function importSanJoseGisLayers(): Promise<void> {
  const sourceDbUrl =
    process.env.SOURCE_GIS_DATABASE_URL ??
    env.DATABASE_URL.replace(/\/[^/?]+(\?.*)?$/, '/sample_db');

  const sourceClient = new Client({ connectionString: sourceDbUrl });
  const targetClient = await pool.connect();

  try {
    await sourceClient.connect();
    console.log('[db:import-boundaries] Connected to source GIS database (`sample_db`).');

    // 1. Extract & dissolve the 12 barangays of San Jose (1608506001 - 1608506012)
    const sourceBoundaries = await sourceClient.query<SourceBoundaryRow>(
      `
      SELECT
        barangay_geo_code::text AS barangay_geo_code,
        LEFT(barangay_geo_code::text, 7) AS city_mun_geo_code,
        RIGHT(barangay_geo_code::text, 3) AS barangay_code,
        TRIM(MAX("NAME")) AS name,
        COUNT(*)::text AS source_parts,
        ST_AsEWKB(
          ST_ForceRHR(
            ST_Multi(
              ST_CollectionExtract(
                ST_MakeValid(ST_SetSRID(ST_Union(geom), 4326)),
                3
              )
            )
          )
        ) AS geom_ewkb
      FROM public."Barangay_Boundaries"
      WHERE LEFT(barangay_geo_code::text, 7) = $1
      GROUP BY barangay_geo_code
      ORDER BY barangay_geo_code;
      `,
      [SAN_JOSE_CITY_MUN_GEO_CODE],
    );

    // 2. Extract ELU_SanJose (26 Land Use MultiPolygons)
    const sourceElu = await sourceClient.query<SourceEluRow>(`
      SELECT
        id AS source_id,
        COALESCE(NULLIF(TRIM("LU_Name"), ''), 'Unspecified') AS lu_name,
        COALESCE(NULLIF(TRIM("LU_Desc"), ''), 'Unspecified') AS lu_category,
        COALESCE("LU_Area", 0)::float8 AS area_hectares,
        COALESCE("LU_Lenght", 0)::float8 AS perimeter_length,
        ST_AsEWKB(
          ST_ForceRHR(
            ST_Multi(
              ST_CollectionExtract(
                ST_MakeValid(ST_SetSRID(geom, 4326)),
                3
              )
            )
          )
        ) AS geom_ewkb
      FROM public."ELU_SanJose"
      WHERE geom IS NOT NULL
      ORDER BY id;
    `);

    // 3. Extract mun_sanjose_landmark (124 Facility Points)
    const sourceLandmarks = await sourceClient.query<SourceLandmarkRow>(`
      SELECT
        id AS source_id,
        COALESCE(NULLIF(TRIM("LANDMARK"), ''), '') AS landmark_type,
        COALESCE(NULLIF(TRIM("LNDMK_DESC"), ''), COALESCE(NULLIF(TRIM("LANDMARK"), ''), 'Unnamed Landmark')) AS name,
        NULLIF(TRIM("LOCATION"), '') AS barangay_name,
        ST_X(geom)::float8 AS longitude,
        ST_Y(geom)::float8 AS latitude,
        ST_AsEWKB(ST_SetSRID(geom, 4326)) AS geom_ewkb
      FROM public."mun_sanjose_landmark"
      WHERE geom IS NOT NULL
      ORDER BY id;
    `);

    // 4. Extract mun_sanjose_roads (239 Road MultiLineStrings)
    const sourceRoads = await sourceClient.query<SourceRoadRow>(`
      SELECT
        id AS source_id,
        COALESCE(NULLIF(TRIM("ROAD_NAME"), ''), 'Unnamed Road') AS road_name,
        REPLACE(COALESCE(NULLIF(TRIM("RD_CLASS"), ''), 'Barangay'), '''', '') AS road_class,
        NULLIF(TRIM("BRGY_NAME"), '') AS barangay_name,
        COALESCE(NULLIF(TRIM("RD_TYPE"), ''), 'Unspecified') AS surface_type,
        CASE
          WHEN TRIM("RD_COND") ILIKE 'Pasable' THEN 'Passable'
          ELSE COALESCE(NULLIF(TRIM("RD_COND"), ''), 'Good')
        END AS road_condition,
        "RD_WIDTH"::float8 AS width_meters,
        "RD_LENGTH"::float8 AS raw_length,
        ROUND(ST_Length(ST_SetSRID(geom, 4326)::geography)::numeric, 2)::float8 AS length_meters,
        "Buffer"::int4 AS buffer_meters,
        NULLIF(TRIM("REMARKS"), '') AS remarks,
        ST_AsEWKB(
          ST_Multi(
            ST_CollectionExtract(
              ST_MakeValid(ST_SetSRID(geom, 4326)),
              2
            )
          )
        ) AS geom_ewkb
      FROM public."mun_sanjose_roads"
      WHERE geom IS NOT NULL
      ORDER BY id;
    `);

    await targetClient.query('BEGIN');

    // Ensure reference tables exist in case db:import-boundaries is run directly
    await targetClient.query(`
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
      CREATE INDEX IF NOT EXISTS idx_road_networks_geom ON public.road_networks USING GIST (geom_line);
    `);

    // 1. Upsert PSGC Parent Hierarchy (Region 16 -> Province 16085 -> Municipality 1608506)
    await targetClient.query(`
      INSERT INTO public.regions (region_code, name)
      VALUES ('16', 'Region XIII (Caraga)')
      ON CONFLICT (region_code) DO UPDATE
      SET name = EXCLUDED.name;
    `);

    await targetClient.query(`
      INSERT INTO public.provinces (province_geo_code, region_code, province_code, name)
      VALUES ('16085', '16', '085', 'Dinagat Islands')
      ON CONFLICT (province_geo_code) DO UPDATE
      SET name = EXCLUDED.name;
    `);

    await targetClient.query(`
      INSERT INTO public.cities_municipalities (
        city_mun_geo_code,
        province_geo_code,
        region_code,
        province_code,
        city_mun_code,
        name
      )
      VALUES ('1608506', '16085', '16', '085', '06', 'San Jose')
      ON CONFLICT (city_mun_geo_code) DO UPDATE
      SET name = EXCLUDED.name;
    `);

    // 2. Upsert the 12 San Jose Barangays
    for (const row of sourceBoundaries.rows) {
      await targetClient.query(
        `
        INSERT INTO public.barangays (
          barangay_geo_code,
          city_mun_geo_code,
          barangay_code,
          name,
          geom_boundary
        )
        VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromEWKB($5), 4326))
        ON CONFLICT (barangay_geo_code) DO UPDATE
        SET
          city_mun_geo_code = EXCLUDED.city_mun_geo_code,
          barangay_code = EXCLUDED.barangay_code,
          name = EXCLUDED.name,
          geom_boundary = EXCLUDED.geom_boundary;
        `,
        [
          row.barangay_geo_code,
          row.city_mun_geo_code,
          row.barangay_code,
          row.name,
          row.geom_ewkb,
        ],
      );
    }
    console.log(`[db:import-boundaries] Upserted ${sourceBoundaries.rows.length} San Jose barangays.`);

    // 3. Upsert ELU_SanJose (26 Land Use Zones)
    for (const elu of sourceElu.rows) {
      const normalizedLuName = normalizeEluName(elu.lu_name);
      await targetClient.query(
        `
        INSERT INTO public.land_use_zones (
          source_id,
          city_mun_geo_code,
          lu_name,
          lu_category,
          area_hectares,
          perimeter_length,
          geom_boundary
        )
        VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_GeomFromEWKB($7), 4326))
        ON CONFLICT (source_id) DO UPDATE
        SET
          lu_name = EXCLUDED.lu_name,
          lu_category = EXCLUDED.lu_category,
          area_hectares = EXCLUDED.area_hectares,
          perimeter_length = EXCLUDED.perimeter_length,
          geom_boundary = EXCLUDED.geom_boundary;
        `,
        [
          elu.source_id,
          SAN_JOSE_CITY_MUN_GEO_CODE,
          normalizedLuName,
          elu.lu_category,
          elu.area_hectares,
          elu.perimeter_length,
          elu.geom_ewkb,
        ],
      );
    }
    console.log(`[db:import-boundaries] Upserted ${sourceElu.rows.length} Existing Land Use (ELU) zones.`);

    // 4. Upsert mun_sanjose_landmark (124 Landmarks) + Spatial Barangay Resolution
    for (const lmk of sourceLandmarks.rows) {
      const normalizedType = normalizeLandmarkType(lmk.landmark_type, lmk.name);
      const sectorCategory = classifyLandmarkSector(normalizedType);

      await targetClient.query(
        `
        INSERT INTO public.municipal_landmarks (
          source_id,
          city_mun_geo_code,
          barangay_name,
          name,
          landmark_type,
          sector_category,
          longitude,
          latitude,
          geom_point
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_GeomFromEWKB($9), 4326))
        ON CONFLICT (source_id) DO UPDATE
        SET
          barangay_name = EXCLUDED.barangay_name,
          name = EXCLUDED.name,
          landmark_type = EXCLUDED.landmark_type,
          sector_category = EXCLUDED.sector_category,
          longitude = EXCLUDED.longitude,
          latitude = EXCLUDED.latitude,
          geom_point = EXCLUDED.geom_point;
        `,
        [
          lmk.source_id,
          SAN_JOSE_CITY_MUN_GEO_CODE,
          lmk.barangay_name,
          lmk.name,
          normalizedType,
          sectorCategory,
          lmk.longitude,
          lmk.latitude,
          lmk.geom_ewkb,
        ],
      );
    }

    // Spatially link landmarks to barangays via ST_Within (fallback to nearest barangay if on coastal edge/port)
    await targetClient.query(
      `
      UPDATE public.municipal_landmarks ml
      SET
        barangay_geo_code = b.barangay_geo_code,
        barangay_name = COALESCE(ml.barangay_name, b.name)
      FROM public.barangays b
      WHERE b.city_mun_geo_code = $1
        AND ST_Intersects(b.geom_boundary, ml.geom_point);
      `,
      [SAN_JOSE_CITY_MUN_GEO_CODE],
    );
    console.log(`[db:import-boundaries] Upserted ${sourceLandmarks.rows.length} municipal landmarks.`);

    // 5. Upsert mun_sanjose_roads (239 Road Network Segments)
    for (const road of sourceRoads.rows) {
      await targetClient.query(
        `
        INSERT INTO public.road_networks (
          source_id,
          city_mun_geo_code,
          barangay_name,
          road_name,
          road_class,
          surface_type,
          road_condition,
          width_meters,
          raw_length,
          length_meters,
          buffer_meters,
          remarks,
          geom_line
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ST_SetSRID(ST_GeomFromEWKB($13), 4326))
        ON CONFLICT (source_id) DO UPDATE
        SET
          barangay_name = EXCLUDED.barangay_name,
          road_name = EXCLUDED.road_name,
          road_class = EXCLUDED.road_class,
          surface_type = EXCLUDED.surface_type,
          road_condition = EXCLUDED.road_condition,
          width_meters = EXCLUDED.width_meters,
          raw_length = EXCLUDED.raw_length,
          length_meters = EXCLUDED.length_meters,
          buffer_meters = EXCLUDED.buffer_meters,
          remarks = EXCLUDED.remarks,
          geom_line = EXCLUDED.geom_line;
        `,
        [
          road.source_id,
          SAN_JOSE_CITY_MUN_GEO_CODE,
          road.barangay_name,
          road.road_name,
          road.road_class,
          road.surface_type,
          road.road_condition,
          road.width_meters,
          road.raw_length,
          road.length_meters,
          road.buffer_meters,
          road.remarks,
          road.geom_ewkb,
        ],
      );
    }
    console.log(`[db:import-boundaries] Upserted ${sourceRoads.rows.length} road network segments.`);

    // 6. Dissolve Barangay Boundaries into Municipal Boundary Polygon
    await targetClient.query(
      `
      UPDATE public.cities_municipalities cm
      SET geom_boundary = sub.geom
      FROM (
        SELECT
          city_mun_geo_code,
          ST_ForceRHR(
            ST_Multi(
              ST_CollectionExtract(
                ST_MakeValid(ST_SetSRID(ST_Union(geom_boundary), 4326)),
                3
              )
            )
          ) AS geom
        FROM public.barangays
        WHERE city_mun_geo_code = $1
          AND geom_boundary IS NOT NULL
        GROUP BY city_mun_geo_code
      ) sub
      WHERE cm.city_mun_geo_code = sub.city_mun_geo_code;
      `,
      [SAN_JOSE_CITY_MUN_GEO_CODE],
    );

    // 7. Ensure default 2024 Survey Year exists and refresh Materialized View
    await targetClient.query(`
      INSERT INTO public.survey_years (survey_year, title, reference_date, psa_approval_no, description, is_active)
      VALUES (
        2024,
        '2024 POPCEN-CBMS',
        '2024-07-01',
        'PSA-2419-02-001',
        '2024 Census of Population and Community-Based Monitoring System - San Jose, Dinagat Islands',
        TRUE
      )
      ON CONFLICT (survey_year) DO NOTHING;
    `);

    await targetClient.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_barangay_yearly_indicators;`);

    await targetClient.query('COMMIT');

    // 8. Final Spatial Summary
    const summary = await targetClient.query<{
      barangays: string;
      elu_zones: string;
      landmarks: string;
      roads: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM public.barangays WHERE city_mun_geo_code = '1608506') AS barangays,
        (SELECT COUNT(*)::text FROM public.land_use_zones WHERE city_mun_geo_code = '1608506') AS elu_zones,
        (SELECT COUNT(*)::text FROM public.municipal_landmarks WHERE city_mun_geo_code = '1608506') AS landmarks,
        (SELECT COUNT(*)::text FROM public.road_networks WHERE city_mun_geo_code = '1608506') AS roads;
    `);

    const counts = summary.rows[0];
    console.log(
      `[db:import-boundaries] Completed! lgeo_cbms_db spatial inventory -> Barangays: ${counts?.barangays}, Land Use Zones: ${counts?.elu_zones}, Landmarks: ${counts?.landmarks}, Roads: ${counts?.roads}.`,
    );
  } catch (err) {
    await targetClient.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    targetClient.release();
    await sourceClient.end().catch(() => undefined);
    await pool.end();
  }
}

importSanJoseGisLayers().catch((err: unknown) => {
  console.error('[db:import-boundaries] Failed:', err);
  process.exit(1);
});
