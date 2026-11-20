import { pool } from './kysely.js';

interface BarangayTargetConfig {
  barangayGeoCode: string;
  name: string;
  householdCount2024: number;
  poorRate2024: number;
  nearPoorRate2024: number;
  electricityRate2024: number;
  internetRate2024: number;
  fourPsRate2024: number;
}

const BARANGAY_CONFIGS: readonly BarangayTargetConfig[] = [
  {
    barangayGeoCode: '1608506001',
    name: 'Aurelio',
    householdCount2024: 48,
    poorRate2024: 0.29,
    nearPoorRate2024: 0.42,
    electricityRate2024: 0.94,
    internetRate2024: 0.52,
    fourPsRate2024: 0.25,
  },
  {
    barangayGeoCode: '1608506002',
    name: 'Cuarinta',
    householdCount2024: 38,
    poorRate2024: 0.47,
    nearPoorRate2024: 0.63,
    electricityRate2024: 0.82,
    internetRate2024: 0.26,
    fourPsRate2024: 0.42,
  },
  {
    barangayGeoCode: '1608506003',
    name: 'Don Ruben',
    householdCount2024: 52,
    poorRate2024: 0.25,
    nearPoorRate2024: 0.38,
    electricityRate2024: 0.96,
    internetRate2024: 0.58,
    fourPsRate2024: 0.21,
  },
  {
    barangayGeoCode: '1608506004',
    name: 'Jacquez',
    householdCount2024: 36,
    poorRate2024: 0.22,
    nearPoorRate2024: 0.33,
    electricityRate2024: 0.97,
    internetRate2024: 0.64,
    fourPsRate2024: 0.19,
  },
  {
    barangayGeoCode: '1608506005',
    name: 'Justiniana Edera',
    householdCount2024: 46,
    poorRate2024: 0.26,
    nearPoorRate2024: 0.39,
    electricityRate2024: 0.95,
    internetRate2024: 0.56,
    fourPsRate2024: 0.24,
  },
  {
    barangayGeoCode: '1608506006',
    name: 'Luna',
    householdCount2024: 44,
    poorRate2024: 0.39,
    nearPoorRate2024: 0.54,
    electricityRate2024: 0.89,
    internetRate2024: 0.36,
    fourPsRate2024: 0.34,
  },
  {
    barangayGeoCode: '1608506007',
    name: 'Mahayahay',
    householdCount2024: 42,
    poorRate2024: 0.33,
    nearPoorRate2024: 0.48,
    electricityRate2024: 0.91,
    internetRate2024: 0.45,
    fourPsRate2024: 0.29,
  },
  {
    barangayGeoCode: '1608506008',
    name: 'Matingbe',
    householdCount2024: 40,
    poorRate2024: 0.35,
    nearPoorRate2024: 0.50,
    electricityRate2024: 0.90,
    internetRate2024: 0.42,
    fourPsRate2024: 0.30,
  },
  {
    barangayGeoCode: '1608506009',
    name: 'Poblacion',
    householdCount2024: 58,
    poorRate2024: 0.14,
    nearPoorRate2024: 0.24,
    electricityRate2024: 0.98,
    internetRate2024: 0.76,
    fourPsRate2024: 0.14,
  },
  {
    barangayGeoCode: '1608506010',
    name: 'San Juan',
    householdCount2024: 45,
    poorRate2024: 0.18,
    nearPoorRate2024: 0.29,
    electricityRate2024: 0.97,
    internetRate2024: 0.69,
    fourPsRate2024: 0.16,
  },
  {
    barangayGeoCode: '1608506011',
    name: 'Sta Cruz',
    householdCount2024: 54,
    poorRate2024: 0.20,
    nearPoorRate2024: 0.31,
    electricityRate2024: 0.96,
    internetRate2024: 0.63,
    fourPsRate2024: 0.18,
  },
  {
    barangayGeoCode: '1608506012',
    name: 'Wilson',
    householdCount2024: 37,
    poorRate2024: 0.43,
    nearPoorRate2024: 0.59,
    electricityRate2024: 0.84,
    internetRate2024: 0.30,
    fourPsRate2024: 0.38,
  },
];

const LAST_NAMES = [
  'Dela Cruz',
  'Ecleo',
  'Reyes',
  'Santos',
  'Mendoza',
  'Villanueva',
  'Bautista',
  'Fernandez',
  'Ramos',
  'Gomez',
  'Navarro',
  'Castillo',
  'Aquino',
  'Salazar',
  'Rivera',
  'Morales',
  'Torres',
  'Flores',
  'De Guzman',
  'Gonzales',
];

const MALE_FIRST_NAMES = [
  'Ricardo',
  'Roberto',
  'Eduardo',
  'Antonio',
  'Marlon',
  'Jomar',
  'Arnel',
  'Rodel',
  'Danilo',
  'Christian',
  'Mark',
  'Joshua',
  'Reynaldo',
  'Ernesto',
  'Jerome',
];

const FEMALE_FIRST_NAMES = [
  'Maria',
  'Elena',
  'Rosario',
  'Evelyn',
  'Marites',
  'Jocelyn',
  'Lorna',
  'Grace',
  'Kristine',
  'Angelica',
  'Teresita',
  'Rowena',
  'Glenda',
  'cherry',
  'Carmela',
];

const PUROK_NAMES = [
  'Purok 1 (Seaside)',
  'Purok 2 (Centro)',
  'Purok 3 (Hilltop)',
  'Purok 4 (Sampaguita)',
  'Purok 5 (Mabuhay)',
  'Purok 6 (Bagong Silang)',
  'Purok 7 (Pag-asa)',
];

function makeDeterministicUuid(year: number, brgyCode: string, index: number): string {
  const hexYear = year.toString(16).padStart(4, '0');
  const hexBrgy = Number(brgyCode.slice(-3)).toString(16).padStart(4, '0');
  const hexIdx = index.toString(16).padStart(12, '0');
  return `cb00${hexYear}-${hexBrgy}-4000-8000-${hexIdx}`;
}

async function seedSampleHouseholds(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure 2022 and 2024 survey years exist
    await client.query(`
      INSERT INTO public.survey_years (survey_year, title, reference_date, psa_approval_no, description, is_active)
      VALUES
        (2022, '2022 CBMS Rollout', '2022-07-01', 'PSA-2219-01-004', '2022 Community-Based Monitoring System Baseline - San Jose, Dinagat Islands', FALSE),
        (2024, '2024 POPCEN-CBMS', '2024-07-01', 'PSA-2419-02-001', '2024 Census of Population and Community-Based Monitoring System - San Jose, Dinagat Islands', TRUE)
      ON CONFLICT (survey_year) DO UPDATE
      SET title = EXCLUDED.title;
    `);

    const syRes = await client.query<{ id: number; survey_year: number }>(
      `SELECT id, survey_year FROM public.survey_years WHERE survey_year IN (2022, 2024) ORDER BY survey_year;`,
    );

    // Clear existing sample households so the seed is idempotent
    await client.query(`DELETE FROM public.households;`);

    let totalHouseholdsInserted = 0;
    let totalMembersInserted = 0;

    for (const sy of syRes.rows) {
      const is2022 = sy.survey_year === 2022;

      for (const cfg of BARANGAY_CONFIGS) {
        const hhCount = is2022 ? Math.max(28, cfg.householdCount2024 - 4) : cfg.householdCount2024;
        const poorRate = is2022 ? Math.min(0.68, cfg.poorRate2024 + 0.05) : cfg.poorRate2024;
        const nearPoorRate = is2022
          ? Math.min(0.78, cfg.nearPoorRate2024 + 0.05)
          : cfg.nearPoorRate2024;
        const elecRate = is2022
          ? Math.max(0.7, cfg.electricityRate2024 - 0.04)
          : cfg.electricityRate2024;
        const netRate = is2022 ? Math.max(0.15, cfg.internetRate2024 - 0.11) : cfg.internetRate2024;
        const fourPsRate = is2022 ? cfg.fourPsRate2024 + 0.02 : cfg.fourPsRate2024;

        // Generate points strictly inside the barangay polygon, preferring habitable road/residential corridors
        const ptsRes = await client.query<{ lng: number; lat: number }>(
          `
          WITH habitable_zone AS (
            SELECT
              COALESCE(
                NULLIF(
                  ST_CollectionExtract(
                    ST_MakeValid(
                      ST_Intersection(
                        b.geom_boundary,
                        COALESCE(
                          (
                            SELECT ST_Union(ST_Buffer(r.geom_line::geography, 95)::geometry)
                            FROM public.road_networks r
                            WHERE ST_Intersects(r.geom_line, b.geom_boundary)
                          ),
                          b.geom_boundary
                        )
                      )
                    ),
                    3
                  ),
                  'GEOMETRYCOLLECTION EMPTY'::geometry
                ),
                b.geom_boundary
              ) AS geom,
              b.geom_boundary AS fallback_geom
            FROM public.barangays b
            WHERE b.barangay_geo_code = $1
          ),
          generated AS (
            SELECT (
              ST_Dump(
                ST_GeneratePoints(
                  CASE
                    WHEN ST_Area(geom) > 0 THEN geom
                    ELSE fallback_geom
                  END,
                  $2::int,
                  $3::int
                )
              )
            ).geom AS pt
            FROM habitable_zone
          )
          SELECT
            ROUND(ST_X(pt)::numeric, 6)::float8 AS lng,
            ROUND(ST_Y(pt)::numeric, 6)::float8 AS lat
          FROM generated;
          `,
          [cfg.barangayGeoCode, hhCount, sy.survey_year + Number(cfg.barangayGeoCode.slice(-3)) * 17],
        );

        for (let i = 0; i < ptsRes.rows.length; i++) {
          const pt = ptsRes.rows[i]!;
          const idx = i + 1;
          const cbmsUuid = makeDeterministicUuid(sy.survey_year, cfg.barangayGeoCode, idx);
          const husn = `${cfg.barangayGeoCode.slice(-3)}-${String(idx).padStart(4, '0')}`;
          const hsn = `${cfg.barangayGeoCode.slice(-3)}-${String(idx).padStart(4, '0')}-01`;

          const hhSize = 2 + ((idx * 3 + Number(cfg.barangayGeoCode.slice(-2))) % 5); // 2 to 6 members
          const males = Math.max(1, Math.floor(hhSize / 2));
          const females = Math.max(1, hhSize - males);

          const isPoor = idx / hhCount <= poorRate ? 1 : 0;
          const isNearPoor5 = isPoor === 1 || idx / hhCount <= nearPoorRate ? 1 : 0;
          const isNearPoor10 = isNearPoor5 === 1 || idx / hhCount <= nearPoorRate + 0.05 ? 1 : 0;
          const isNearPoor15 = isNearPoor10 === 1 || idx / hhCount <= nearPoorRate + 0.09 ? 1 : 0;
          const isNearPoor20 = isNearPoor15 === 1 || idx / hhCount <= nearPoorRate + 0.13 ? 1 : 0;
          const isNearPoor25 = isNearPoor20 === 1 || idx / hhCount <= nearPoorRate + 0.17 ? 1 : 0;

          const hasElec = idx / hhCount <= elecRate ? 1 : 2;
          const hasInternet = idx / hhCount <= netRate ? 1 : 2;
          const is4Ps = idx / hhCount <= fourPsRate ? 1 : 2;

          const lastName = LAST_NAMES[(idx + Number(cfg.barangayGeoCode.slice(-2))) % LAST_NAMES.length]!;
          const purok = PUROK_NAMES[idx % PUROK_NAMES.length]!;
          const houseNo = `Blk ${(idx % 8) + 1} Lot ${(idx % 15) + 1}`;

          const hhInsert = await client.query<{ id: string }>(
            `
            INSERT INTO public.households (
              survey_year_id,
              cbms_uuid,
              city_mun_geo_code,
              barangay_geo_code,
              city_mun_name,
              barangay_name,
              region_code,
              province_code,
              city_mun_code,
              barangay_code,
              husn,
              hsn,
              longitude,
              latitude,
              hh_size,
              number_of_males,
              number_of_females,
              number_of_nuclear_families,
              respondent_line_number,
              agree_to_sign_the_waiver,
              address_house_number,
              address_street_name,
              address_sitio_purok
            )
            VALUES (
              $1, $2, '1608506', $3, 'San Jose', $4, '16', '085', '06', $5,
              $6, $7, $8, $9, $10, $11, $12, 1, '01', 1, $13, $14, $15
            )
            RETURNING id;
            `,
            [
              sy.id,
              cbmsUuid,
              cfg.barangayGeoCode,
              cfg.name,
              cfg.barangayGeoCode.slice(-3),
              husn,
              hsn,
              pt.lng,
              pt.lat,
              hhSize,
              males,
              females,
              houseNo,
              `${cfg.name} Provincial Road`,
              purok,
            ],
          );

          const householdId = hhInsert.rows[0]!.id;
          totalHouseholdsInserted++;

          // Insert Household Poverty (Section Poverty)
          await client.query(
            `
            INSERT INTO public.household_poverty (
              household_id, poor, near_poor_5_pct, near_poor_10_pct, near_poor_15_pct, near_poor_20_pct, near_poor_25_pct
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7);
            `,
            [householdId, isPoor, isNearPoor5, isNearPoor10, isNearPoor15, isNearPoor20, isNearPoor25],
          );

          // Insert Household Housing (Section O)
          const roofCode = isPoor === 1 ? (idx % 2 === 0 ? 3 : 2) : 1; // 1=Galvanized Iron/Strong, 2=Wood, 3=Nipa/Light
          const wallCode = isPoor === 1 ? (idx % 2 === 0 ? 3 : 2) : 1; // 1=Concrete, 2=Wood, 3=Bamboo/Nipa
          const tenureCode = isPoor === 1 && idx % 3 === 0 ? 3 : 1; // 1=Own house & lot, 3=Rent-free w/ consent
          await client.query(
            `
            INSERT INTO public.household_housing (
              household_id, o01_building_type, o02_number_of_floors, o03_roof, o04_outer_walls,
              o07_floor_area, o08_number_of_bedrooms, o09_tenure, o11_electricity
            )
            VALUES ($1, 1, 1, $2, $3, $4, $5, $6, $7);
            `,
            [householdId, roofCode, wallCode, isPoor ? 28 : 54, isPoor ? 1 : 2, tenureCode, hasElec],
          );

          // Insert Household Connectivity & Safety (Sections H, K, L)
          await client.query(
            `
            INSERT INTO public.household_connectivity_safety (
              household_id, h01_puv_access, k01_internet_access, k02_internet_at_home, l01_safe_walking_alone
            )
            VALUES ($1, 1, $2, $3, 1);
            `,
            [householdId, hasInternet, hasInternet],
          );

          // Insert Household Social Protection (Section M)
          await client.query(
            `
            INSERT INTO public.household_social_protection (
              household_id, m01_c_philhealth, m05_a_4ps, m05_b_socpen, m06_a_benefit_4ps
            )
            VALUES ($1, 1, $2, $3, $2);
            `,
            [householdId, is4Ps, idx % 6 === 0 ? 1 : 2],
          );

          // Insert Household WASH (Section N)
          await client.query(
            `
            INSERT INTO public.household_wash (
              household_id, n01_main_water, n02_drinking_water, n03_service_level_drinking_water,
              n08_toilet_facility, n08_service_level_toilet_facility
            )
            VALUES ($1, $2, $2, $3, 1, $3);
            `,
            [householdId, isPoor ? 3 : 1, isPoor ? 2 : 1],
          );

          // Insert Household Disaster Shocks (Section J)
          await client.query(
            `
            INSERT INTO public.household_disaster_shocks (
              household_id, j01_a_typhoon, j01_d_rain_or_flood, j02_location_of_evacuation, j03_contact_hotline
            )
            VALUES ($1, $2, $3, 1, 1);
            `,
            [householdId, idx % 3 === 0 ? 1 : 2, idx % 5 === 0 ? 1 : 2],
          );

          // Insert Household Members (Sections A, B, D, E)
          for (let m = 1; m <= hhSize; m++) {
            const lineNo = String(m).padStart(2, '0');
            const sex = m === 1 ? 1 : m === 2 ? 2 : (m % 2) + 1;
            const firstName =
              sex === 1
                ? MALE_FIRST_NAMES[(idx + m) % MALE_FIRST_NAMES.length]!
                : FEMALE_FIRST_NAMES[(idx + m) % FEMALE_FIRST_NAMES.length]!;
            const age =
              m === 1
                ? 34 + (idx % 32)
                : m === 2
                  ? 31 + (idx % 30)
                  : 4 + ((idx * 3 + m * 5) % 22);
            const relationCode = m === 1 ? 1 : m === 2 ? 2 : 3; // 1=Head, 2=Spouse, 3=Child
            const isSenior = age >= 60 ? 1 : 2;
            const isPwd = m === 1 && idx % 11 === 0 ? 1 : 2;

            const memInsert = await client.query<{ id: string }>(
              `
              INSERT INTO public.household_members (
                household_id, survey_year_id, line_number, city_mun_geo_code_x, barangay_geo_code_x,
                city_mun_x, barangay_x, husn_x, hsn_x
              )
              VALUES ($1, $2, $3, '1608506', $4, 'San Jose', $5, $6, $7)
              RETURNING id;
              `,
              [householdId, sy.id, lineNo, cfg.barangayGeoCode, cfg.name, husn, hsn],
            );

            const memberId = memInsert.rows[0]!.id;
            totalMembersInserted++;

            await client.query(
              `
              INSERT INTO public.member_demographics_core (
                member_id, a01_last_name, a01_first_name, a01_middle_name,
                a02_relation_to_hh_head, a03_sex, a05_age, a06_lcr_reg_status, a10_simple_literacy
              )
              VALUES ($1, $2, $3, 'Gomez', $4, $5, $6, 1, 1);
              `,
              [memberId, lastName, firstName, relationCode, sex, age],
            );

            await client.query(
              `
              INSERT INTO public.member_demographics_other (
                member_id, b03_phil_id, b05_solo_parent, b07_senior_citizen_id, b10_pwd
              )
              VALUES ($1, 1, $2, $3, $4);
              `,
              [memberId, m === 1 && hhSize === 2 ? 1 : 2, isSenior, isPwd],
            );

            await client.query(
              `
              INSERT INTO public.member_education (
                member_id, d01_currently_attending_school, d02_type_of_school_attended
              )
              VALUES ($1, $2, 1);
              `,
              [memberId, age >= 5 && age <= 21 ? 1 : 2],
            );

            await client.query(
              `
              INSERT INTO public.member_economics (
                member_id, e01_labor_force_participation, e01_employment_status, e17_farmer, e18_fisherfolk
              )
              VALUES ($1, $2, $3, $4, $5);
              `,
              [
                memberId,
                age >= 18 && age <= 64 ? 1 : 2,
                age >= 18 && age <= 64 ? 1 : 2,
                m === 1 && idx % 4 === 0 ? 1 : 2,
                m === 1 && idx % 5 === 0 ? 1 : 2,
              ],
            );
          }
        }
      }
    }

    await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_barangay_yearly_indicators;`);
    await client.query('COMMIT');

    console.log(
      `[db:seed-households] Seeded ${totalHouseholdsInserted} spatially-verified households and ${totalMembersInserted} members across 12 San Jose barangays (2022 & 2024).`,
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSampleHouseholds().catch((err: unknown) => {
  console.error('[db:seed-households] Failed:', err);
  process.exit(1);
});
