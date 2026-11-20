import { Router } from 'express';
import { sql } from 'kysely';
import {
  ChoroplethQuerySchema,
  CBMS_SECTIONS,
  HEADLINE_CHOROPLETH_METRICS,
  LANDMARK_SECTORS,
} from '@cbms/shared';
import { db } from '../../db/kysely.js';

export const gisRouter = Router();

/**
 * GET /api/v1/gis/metadata
 * Returns available CBMS Sections (A-O + Poverty), Headline Choropleth metrics, and Landmark Sectors
 */
gisRouter.get('/metadata', (_req, res) => {
  res.json({
    sections: CBMS_SECTIONS,
    choroplethMetrics: HEADLINE_CHOROPLETH_METRICS,
    landmarkSectors: LANDMARK_SECTORS,
  });
});

/**
 * GET /api/v1/gis/choropleth?surveyYear=2024&metric=poor_rate
 * Fast-path Barangay Choropleth query against mv_barangay_yearly_indicators + ST_AsGeoJSON
 */
gisRouter.get('/choropleth', async (req, res) => {
  const parsed = ChoroplethQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    return;
  }

  const { surveyYear, metric } = parsed.data;

  try {
    const queryResult = await sql<{
      survey_year: number;
      barangay_geo_code: string;
      barangay_name: string;
      city_mun_geo_code: string;
      city_mun_name: string;
      total_households: string;
      total_population: string;
      poor_households: string;
      near_poor_5_households: string;
      near_poor_10_households: string;
      near_poor_15_households: string;
      near_poor_20_households: string;
      near_poor_25_households: string;
      households_with_electricity: string;
      households_with_home_internet: string;
      households_4ps_beneficiaries: string;
      geojson: string | null;
      label_lng: number | null;
      label_lat: number | null;
    }>`
      SELECT
        ${surveyYear}::int AS survey_year,
        b.barangay_geo_code,
        b.name AS barangay_name,
        b.city_mun_geo_code,
        cm.name AS city_mun_name,
        COALESCE(mv.total_households, 0)::text AS total_households,
        COALESCE(mv.total_population, 0)::text AS total_population,
        COALESCE(mv.poor_households, 0)::text AS poor_households,
        COALESCE(mv.near_poor_5_households, 0)::text AS near_poor_5_households,
        COALESCE(mv.near_poor_10_households, 0)::text AS near_poor_10_households,
        COALESCE(mv.near_poor_15_households, 0)::text AS near_poor_15_households,
        COALESCE(mv.near_poor_20_households, 0)::text AS near_poor_20_households,
        COALESCE(mv.near_poor_25_households, 0)::text AS near_poor_25_households,
        COALESCE(mv.households_with_electricity, 0)::text AS households_with_electricity,
        COALESCE(mv.households_with_home_internet, 0)::text AS households_with_home_internet,
        COALESCE(mv.households_4ps_beneficiaries, 0)::text AS households_4ps_beneficiaries,
        ST_AsGeoJSON(b.geom_boundary) AS geojson,
        ST_X(ST_PointOnSurface(b.geom_boundary)) AS label_lng,
        ST_Y(ST_PointOnSurface(b.geom_boundary)) AS label_lat
      FROM public.barangays b
      JOIN public.cities_municipalities cm ON cm.city_mun_geo_code = b.city_mun_geo_code
      LEFT JOIN public.mv_barangay_yearly_indicators mv
        ON mv.barangay_geo_code = b.barangay_geo_code
       AND mv.survey_year = ${surveyYear}
      ORDER BY b.barangay_geo_code ASC;
    `.execute(db);

    const rows = queryResult.rows;

    const features = rows.map((row) => {
      const totalHh = Number(row.total_households);
      const poorHh = Number(row.poor_households);
      const nearPoor5Hh = Number(row.near_poor_5_households);
      const nearPoor10Hh = Number(row.near_poor_10_households);
      const nearPoor15Hh = Number(row.near_poor_15_households);
      const nearPoor20Hh = Number(row.near_poor_20_households);
      const nearPoor25Hh = Number(row.near_poor_25_households);
      const elecHh = Number(row.households_with_electricity);
      const netHh = Number(row.households_with_home_internet);
      const fourPsHh = Number(row.households_4ps_beneficiaries);

      const toRate = (count: number) => (totalHh > 0 ? Number(((count / totalHh) * 100).toFixed(2)) : 0);

      return {
        type: 'Feature' as const,
        geometry: row.geojson ? JSON.parse(row.geojson) : null,
        properties: {
          barangayGeoCode: row.barangay_geo_code,
          barangayName: row.barangay_name,
          cityMunName: row.city_mun_name,
          totalHouseholds: totalHh,
          totalPopulation: Number(row.total_population),
          poorHouseholds: poorHh,
          labelLng: row.label_lng,
          labelLat: row.label_lat,
          poor_rate: toRate(poorHh),
          near_poor_5_rate: toRate(nearPoor5Hh),
          near_poor_10_rate: toRate(nearPoor10Hh),
          near_poor_15_rate: toRate(nearPoor15Hh),
          near_poor_20_rate: toRate(nearPoor20Hh),
          near_poor_25_rate: toRate(nearPoor25Hh),
          electricity_rate: toRate(elecHh),
          internet_rate: toRate(netHh),
          beneficiary_4ps_rate: toRate(fourPsHh),
          // Legacy aliases for backward compatibility
          electricity_access_rate: toRate(elecHh),
          home_internet_rate: toRate(netHh),
          four_ps_coverage_rate: toRate(fourPsHh),
        },
      };
    });

    res.json({
      type: 'FeatureCollection',
      metadata: { surveyYear, metric, featureCount: features.length },
      features,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to query barangay choropleth layer',
      message: err instanceof Error ? err.message : 'Unknown database error',
    });
  }
});

/**
 * GET /api/v1/gis/land-use
 * Returns Existing Land Use (ELU_SanJose) MultiPolygon GeoJSON FeatureCollection (EPSG:4326)
 */
gisRouter.get('/land-use', async (_req, res) => {
  try {
    const rows = await db
      .selectFrom('land_use_zones')
      .select([
        'id',
        'lu_name',
        'lu_category',
        'area_hectares',
        'perimeter_length',
        sql<string>`ST_AsGeoJSON(geom_boundary)`.as('geojson'),
      ])
      .orderBy('area_hectares', 'desc')
      .execute();

    const features = rows.map((r) => ({
      type: 'Feature' as const,
      id: r.id,
      geometry: JSON.parse(r.geojson),
      properties: {
        id: r.id,
        luName: r.lu_name,
        luCategory: r.lu_category,
        areaHectares: Number(r.area_hectares.toFixed(2)),
        perimeterLength: Number(r.perimeter_length.toFixed(2)),
      },
    }));

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      type: 'FeatureCollection',
      metadata: {
        layer: 'land_use_zones',
        featureCount: features.length,
        totalAreaHectares: Number(
          features.reduce((acc, f) => acc + f.properties.areaHectares, 0).toFixed(2),
        ),
      },
      features,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to query land use zones layer',
      message: err instanceof Error ? err.message : 'Unknown database error',
    });
  }
});

/**
 * GET /api/v1/gis/landmarks
 * Returns Municipal Landmarks / Critical Facilities Point GeoJSON FeatureCollection (EPSG:4326)
 */
gisRouter.get('/landmarks', async (req, res) => {
  const sectorFilter = typeof req.query.sector === 'string' ? req.query.sector : undefined;

  try {
    let query = db
      .selectFrom('municipal_landmarks')
      .select([
        'id',
        'name',
        'landmark_type',
        'sector_category',
        'barangay_geo_code',
        'barangay_name',
        sql<number>`ST_X(geom_point)`.as('longitude'),
        sql<number>`ST_Y(geom_point)`.as('latitude'),
        sql<string>`ST_AsGeoJSON(geom_point)`.as('geojson'),
      ])
      .orderBy('id', 'asc');

    if (sectorFilter && sectorFilter !== 'ALL') {
      query = query.where('sector_category', '=', sectorFilter);
    }

    const rows = await query.execute();

    const features = rows.map((r) => ({
      type: 'Feature' as const,
      id: r.id,
      geometry: JSON.parse(r.geojson),
      properties: {
        id: r.id,
        name: r.name,
        landmarkType: r.landmark_type,
        sectorCategory: r.sector_category,
        barangayGeoCode: r.barangay_geo_code,
        barangayName: r.barangay_name,
        longitude: Number(r.longitude),
        latitude: Number(r.latitude),
      },
    }));

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      type: 'FeatureCollection',
      metadata: {
        layer: 'municipal_landmarks',
        featureCount: features.length,
      },
      features,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to query municipal landmarks layer',
      message: err instanceof Error ? err.message : 'Unknown database error',
    });
  }
});

/**
 * GET /api/v1/gis/landmarks/:id/catchment?radiusMeters=500&surveyYear=2024
 * PostGIS ST_DWithin metric spheroidal catchment query around a selected facility
 */
gisRouter.get('/landmarks/:id/catchment', async (req, res) => {
  const landmarkId = Number(req.params.id);
  const radiusMeters = Math.min(Math.max(Number(req.query.radiusMeters ?? 500), 50), 5000);
  const surveyYear = Number(req.query.surveyYear ?? 2024);

  if (Number.isNaN(landmarkId)) {
    res.status(400).json({ error: 'Invalid landmark ID' });
    return;
  }

  try {
    const result = await sql<{
      landmark_id: number;
      landmark_name: string;
      landmark_type: string;
      sector_category: string;
      households_in_radius: string;
      population_in_radius: string;
      poor_households_in_radius: string;
      buffer_geojson: string;
    }>`
      SELECT
        ml.id AS landmark_id,
        ml.name AS landmark_name,
        ml.landmark_type,
        ml.sector_category,
        COUNT(DISTINCT h.id)::text AS households_in_radius,
        COALESCE(SUM(h.hh_size), 0)::text AS population_in_radius,
        COUNT(DISTINCT h.id) FILTER (WHERE hp.poor = 1)::text AS poor_households_in_radius,
        ST_AsGeoJSON(ST_Buffer(ml.geom_point::geography, ${radiusMeters})::geometry) AS buffer_geojson
      FROM public.municipal_landmarks ml
      LEFT JOIN public.survey_years sy ON sy.survey_year = ${surveyYear}
      LEFT JOIN public.households h
        ON h.survey_year_id = sy.id
       AND h.geom_point IS NOT NULL
       AND ST_DWithin(h.geom_point::geography, ml.geom_point::geography, ${radiusMeters})
      LEFT JOIN public.household_poverty hp ON hp.household_id = h.id
      WHERE ml.id = ${landmarkId}
      GROUP BY ml.id, ml.name, ml.landmark_type, ml.sector_category, ml.geom_point;
    `.execute(db);

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Landmark not found' });
      return;
    }

    res.json({
      landmarkId: row.landmark_id,
      landmarkName: row.landmark_name,
      landmarkType: row.landmark_type,
      sectorCategory: row.sector_category,
      radiusMeters,
      surveyYear,
      householdsInRadius: Number(row.households_in_radius),
      populationInRadius: Number(row.population_in_radius),
      poorHouseholdsInRadius: Number(row.poor_households_in_radius),
      bufferGeoJson: JSON.parse(row.buffer_geojson),
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to compute facility catchment buffer',
      message: err instanceof Error ? err.message : 'Unknown database error',
    });
  }
});

/**
 * GET /api/v1/gis/roads
 * Returns Municipal Road Network MultiLineString GeoJSON FeatureCollection (EPSG:4326)
 */
gisRouter.get('/roads', async (_req, res) => {
  try {
    const rows = await db
      .selectFrom('road_networks')
      .select([
        'id',
        'road_name',
        'road_class',
        'barangay_name',
        'surface_type',
        'road_condition',
        'width_meters',
        'length_meters',
        sql<string>`ST_AsGeoJSON(geom_line)`.as('geojson'),
      ])
      .orderBy('id', 'asc')
      .execute();

    const features = rows.map((r) => ({
      type: 'Feature' as const,
      id: r.id,
      geometry: JSON.parse(r.geojson),
      properties: {
        id: r.id,
        roadName: r.road_name,
        roadClass: r.road_class,
        barangayName: r.barangay_name,
        surfaceType: r.surface_type,
        roadCondition: r.road_condition,
        widthMeters: r.width_meters !== null ? Number(r.width_meters) : null,
        lengthMeters: Number(r.length_meters),
      },
    }));

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      type: 'FeatureCollection',
      metadata: {
        layer: 'road_networks',
        featureCount: features.length,
        totalLengthKm: Number(
          (features.reduce((acc, f) => acc + f.properties.lengthMeters, 0) / 1000).toFixed(2),
        ),
      },
      features,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to query road networks layer',
      message: err instanceof Error ? err.message : 'Unknown database error',
    });
  }
});

/**
 * GET /api/v1/gis/tiles/households/:z/:x/:y.pbf
 * PostGIS ST_AsMVT dynamic binary vector tile endpoint for household points
 */
gisRouter.get('/tiles/households/:z/:x/:y.pbf', async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);
  const surveyYear = Number(req.query.surveyYear ?? 2024);

  if (Number.isNaN(z) || Number.isNaN(x) || Number.isNaN(y)) {
    res.status(400).json({ error: 'Invalid tile coordinates' });
    return;
  }

  try {
    const mvtQuery = await sql<{ mvt: Buffer }>`
      WITH mvtgeom AS (
        SELECT
          h.id::text AS id,
          h.id::text AS household_id,
          h.cbms_uuid AS "cbmsUuid",
          h.husn,
          h.hsn,
          h.barangay_geo_code AS "barangayGeoCode",
          h.barangay_name AS "barangayName",
          h.address_sitio_purok AS "sitioPurok",
          h.address_house_number AS "houseNumber",
          h.longitude,
          h.latitude,
          h.hh_size AS "hhSize",
          COALESCE(hp.poor, 0) AS poor,
          COALESCE(hp.near_poor_5_pct, 0) AS "nearPoor5",
          CASE WHEN hho.o11_electricity = 1 THEN 1 ELSE 0 END AS electricity,
          CASE WHEN hcs.k02_internet_at_home = 1 THEN 1 ELSE 0 END AS "internetAtHome",
          CASE WHEN hsp.m05_a_4ps = 1 THEN 1 ELSE 0 END AS "fourPsBeneficiary",
          CASE WHEN EXISTS (
            SELECT 1 FROM household_members hm
            JOIN member_demographics_core mdc ON mdc.member_id = hm.id
            WHERE hm.household_id = h.id AND mdc.a05_age >= 60
          ) THEN 1 ELSE 0 END AS "hasSenior",
          CASE WHEN EXISTS (
            SELECT 1 FROM household_members hm
            JOIN member_demographics_other mdo ON mdo.member_id = hm.id
            WHERE hm.household_id = h.id AND mdo.b10_pwd = 1
          ) THEN 1 ELSE 0 END AS "hasPwd",
          CASE WHEN EXISTS (
            SELECT 1 FROM household_members hm
            JOIN member_demographics_other mdo ON mdo.member_id = hm.id
            WHERE hm.household_id = h.id AND mdo.b05_solo_parent = 1
          ) THEN 1 ELSE 0 END AS "hasSoloParent",
          CASE WHEN COALESCE(hfs.g04_skipped_meal, 0) = 1 OR COALESCE(hfs.g06_ran_out_of_food, 0) = 1 OR COALESCE(hfs.g07_hungry, 0) = 1 THEN 1 ELSE 0 END AS "foodInsecure",
          CASE WHEN COALESCE(hds.j01_a_typhoon, 0) = 1 OR COALESCE(hds.j01_d_rain_or_flood, 0) = 1 OR COALESCE(hds.j01_e_erosion_landslide, 0) = 1 THEN 1 ELSE 0 END AS "disasterShock",
          CASE WHEN COALESCE(hw.n03_service_level_drinking_water, hw.n02_drinking_water, 1) > 1 THEN 1 ELSE 0 END AS "unimprovedWater",
          CASE WHEN COALESCE(hho.o03_roof, 1) >= 3 OR COALESCE(hho.o04_outer_walls, 1) >= 3 THEN 1 ELSE 0 END AS "makeshiftHousing",
          CASE
            WHEN hho.o03_roof = 1 THEN 'Strong Material (Galvanized Iron)'
            WHEN hho.o03_roof = 2 THEN 'Mixed Material (Wood / GI)'
            ELSE 'Light Material (Nipa / Cogon)'
          END AS "roofMaterial",
          CASE
            WHEN hho.o04_outer_walls = 1 THEN 'Strong Material (Concrete / Brick)'
            WHEN hho.o04_outer_walls = 2 THEN 'Mixed Material (Wood)'
            ELSE 'Light Material (Bamboo / Sawali)'
          END AS "wallMaterial",
          CASE
            WHEN hw.n02_drinking_water = 1 THEN 'Level III Piped Water Supply'
            ELSE 'Level II Communal Faucet / Spring'
          END AS "drinkingWaterSource",
          COALESCE(head_mem.head_name, 'Household Head') AS "headName",
          COALESCE(mem_roster.members_json, '[]') AS "membersJson",
          ST_AsMVTGeom(
            ST_Transform(h.geom_point, 3857),
            ST_TileEnvelope(${z}, ${x}, ${y}),
            4096,
            64,
            true
          ) AS geom
        FROM households h
        JOIN survey_years sy ON sy.id = h.survey_year_id
        LEFT JOIN household_poverty hp ON hp.household_id = h.id
        LEFT JOIN household_housing hho ON hho.household_id = h.id
        LEFT JOIN household_connectivity_safety hcs ON hcs.household_id = h.id
        LEFT JOIN household_social_protection hsp ON hsp.household_id = h.id
        LEFT JOIN household_wash hw ON hw.household_id = h.id
        LEFT JOIN household_food_security hfs ON hfs.household_id = h.id
        LEFT JOIN household_disaster_shocks hds ON hds.household_id = h.id
        LEFT JOIN LATERAL (
          SELECT CONCAT(mdc.a01_first_name, ' ', mdc.a01_last_name) AS head_name
          FROM household_members hm
          JOIN member_demographics_core mdc ON mdc.member_id = hm.id
          WHERE hm.household_id = h.id
          ORDER BY hm.line_number ASC
          LIMIT 1
        ) head_mem ON true
        LEFT JOIN LATERAL (
          SELECT json_agg(
            json_build_object(
              'lineNumber', hm.line_number,
              'firstName', COALESCE(mdc.a01_first_name, ''),
              'lastName', COALESCE(mdc.a01_last_name, ''),
              'sex', CASE WHEN mdc.a03_sex = 1 THEN 'Male' ELSE 'Female' END,
              'age', COALESCE(mdc.a05_age, 0),
              'relationToHead', CASE
                WHEN mdc.a02_relation_to_hh_head = 1 THEN 'Head'
                WHEN mdc.a02_relation_to_hh_head = 2 THEN 'Spouse'
                ELSE 'Child'
              END,
              'isPwd', COALESCE(mdo.b10_pwd = 1, false),
              'isSeniorCitizen', COALESCE(mdc.a05_age >= 60, false),
              'isSoloParent', COALESCE(mdo.b05_solo_parent = 1, false),
              'attendingSchool', COALESCE(med.d01_currently_attending_school = 1, false),
              'occupation', CASE
                WHEN mec.e18_fisherfolk = 1 THEN 'Fisherfolk'
                WHEN mec.e17_farmer = 1 THEN 'Farmer'
                WHEN mec.e01_employment_status = 1 THEN 'Employed'
                WHEN med.d01_currently_attending_school = 1 THEN 'Student'
                ELSE 'Dependent / Homemaker'
              END
            ) ORDER BY hm.line_number ASC
          )::text AS members_json
          FROM household_members hm
          LEFT JOIN member_demographics_core mdc ON mdc.member_id = hm.id
          LEFT JOIN member_demographics_other mdo ON mdo.member_id = hm.id
          LEFT JOIN member_education med ON med.member_id = hm.id
          LEFT JOIN member_economics mec ON mec.member_id = hm.id
          WHERE hm.household_id = h.id
        ) mem_roster ON true
        WHERE sy.survey_year = ${surveyYear}
          AND h.geom_point IS NOT NULL
          AND h.geom_point && ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326)
      )
      SELECT ST_AsMVT(mvtgeom.*, 'households', 4096, 'geom') AS mvt
      FROM mvtgeom;
    `.execute(db);

    const tileBuffer = mvtQuery.rows[0]?.mvt;
    res.setHeader('Content-Type', 'application/x-protobuf');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).send(tileBuffer ?? Buffer.alloc(0));
  } catch (err) {
    res.status(500).json({
      error: 'Failed to generate MVT tile',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});
