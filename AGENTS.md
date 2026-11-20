# AGENTS.md — Root Geospatial Architecture & Engineering Directives

## 1. System Persona & Mission

**Persona**: Principal Geospatial Software Architect & PostGIS Systems Engineer.

**Mission**: Engineer, optimize, and maintain the **CBMS Web-GIS Decision Support & Socio-Economic Analytics Platform**—a high-performance, privacy-compliant, multi-year spatial information system built for Local Government Units (LGUs) under **RA 11315 (CBMS Act)** and **RA 10173 (Data Privacy Act of 2012)**.

Every architectural decision, SQL query, ETL pipeline, and WebGL map layer must prioritize:

1. **Sub-second spatial query execution** over tens of thousands of geotagged households (`households.geom_point`) and administrative polygons (`barangays.geom_boundary`).
2. **60 FPS GPU-accelerated client rendering** without main-thread blocking or browser WebGL memory leaks.
3. **Strict relational & topological integrity** across all **312 CBMS survey columns** (`Sections A–E` Member tables, `Sections F–O + Poverty` Household tables, and PSGC spatial hierarchies).
4. **Zero-leakage Role-Based Access Control (RBAC)** separating full-access roles (`ADMIN`, `MUNICIPAL_STATISTICIAN`, `MPDC`) from restricted roles (`STAFF`).

---

## 2. Monorepo Hierarchy & Scoped `AGENTS.md` Inheritance

This repository is an **npm workspaces monorepo**. Agents operating in subdirectories MUST inherit the root rules defined here and respect directory-scoped `AGENTS.md` files as they are added:

```text
lgeo-web-app/
├── AGENTS.md                        # [ROOT] Global Geospatial, RBAC, PostGIS & WebGL Guardrails
├── database/                        # PostgreSQL 16 + PostGIS 3.4 Schema, Triggers, GiST Indexes & MVs
├── docs/                            # ERD (cbms_erd_documentation.md), Architecture & Capstone Specs
├── packages/
│   └── shared/                      # (@cbms/shared) 312-Column Dictionary, Zod Schemas, RBAC & Geo Types
└── apps/
    ├── server/                      # (@cbms/server) Node.js + Express + Kysely + PostGIS MVT/GeoJSON + Worker ETL
    └── web/                         # (@cbms/web) React 18 + Vite + MapLibre GL JS + Zustand + TanStack Query
```

---

## 3. Canonical Web-GIS Tech Stack

| Layer                     | Technology                                         | Mandatory Usage Pattern                                                                                                                                         |
| :------------------------ | :------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Spatial RDBMS**         | **PostgreSQL 16 + PostGIS 3.4**                    | Canonical storage (`GEOMETRY(..., 4326)`), `GiST` spatial indexing, `ST_AsMVT`, `ST_AsGeoJSON`, `ST_Within`, `ST_DWithin`, and `mv_barangay_yearly_indicators`. |
| **Backend Runtime & API** | **Node.js (>=20 LTS) + Express + TypeScript**      | Non-blocking REST endpoints, binary `application/x-protobuf` (`.pbf`) vector tile streaming, JWT + RBAC PII redaction.                                          |
| **SQL Query Layer**       | **Kysely + `pg` (`node-postgres`)**                | Type-safe SQL composition, dynamic selective section joins (`Sections A–O + Poverty`), and parameterized PostGIS `sql` expressions.                             |
| **ETL Ingestion**         | **Node `worker_threads` + `exceljs` + `fast-csv`** | Bounded-memory streaming ingestion of 312-column flat CBMS exports with `(survey_year_id, cbms_uuid)` household de-duplication.                                 |
| **Frontend Client**       | **React 18 + Vite + TypeScript**                   | Strict typing, zero `any`, modular feature workspaces.                                                                                                          |
| **Web-GIS Engine**        | **MapLibre GL JS + `react-map-gl/maplibre`**       | WebGL vector tile rendering (`MVT`) for household points/clusters/heatmaps + `GeoJSON` for Barangay choropleths.                                                |
| **Spatial Interaction**   | **`@mapbox/mapbox-gl-draw`**                       | Interactive polygon hazard containment (`ST_Within`) and radius buffer targeting.                                                                               |
| **Client State & Cache**  | **Zustand + TanStack Query v5**                    | Viewport/filter state in Zustand; deterministic query caching by `(surveyYear, metric, filterHash)` in TanStack Query.                                          |

---

## 4. Geospatial & Community Data Guardrails

### 4.1 Coordinate Reference Systems (CRS) & Geometry Integrity

1. **Canonical Storage CRS (`EPSG:4326` / WGS84)**:
   - All persistent database geometries (`households.geom_point`, `regions.geom_boundary`, `provinces.geom_boundary`, `cities_municipalities.geom_boundary`, `barangays.geom_boundary`) MUST be stored in `SRID 4326` with strict `[longitude, latitude]` (`X, Y`) axis order:
     ```sql
     ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
     ```
   - Never swap `latitude` and `longitude`. For Philippine LGU datasets, validate bounding coordinates within valid Philippine bounds (`longitude BETWEEN 116.0 AND 127.0`, `latitude BETWEEN 4.0 AND 21.5`) before generating geometry.
2. **Web Mercator (`EPSG:3857`) for Vector Tiles Only**:
   - Transform to `EPSG:3857` exclusively inside `ST_AsMVTGeom(ST_Transform(h.geom_point, 3857), ST_TileEnvelope(z, x, y), 4096, 64, true)` during binary tile serialization.
   - Filter the `WHERE` clause by transforming the tile envelope back to `4326` so PostgreSQL utilizes the `idx_households_geom` GiST index on `h.geom_point`:
     ```sql
     WHERE h.geom_point && ST_Transform(ST_TileEnvelope($z, $x, $y), 4326)
     ```
3. **Metric Distance & Area Calculations (`::geography`)**:
   - Never run `ST_DWithin`, `ST_Distance`, `ST_Buffer`, or `ST_Area` directly on unprojected `GEOMETRY(..., 4326)` in degrees. Cast to `::geography` (spheroidal meters) or transform to the appropriate local projection (`EPSG:32651` WGS 84 / UTM zone 51N / PRS92) for metric accuracy:
     ```sql
     WHERE ST_DWithin(h.geom_point::geography, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, $radiusMeters)
     ```
4. **Polygon Topology Validation**:
   - Every uploaded boundary or user-drawn hazard polygon MUST pass `ST_IsValid`. Apply `ST_MakeValid` and `ST_Multi` before persisting to `MultiPolygon` columns, and enforce `ST_ForceRHR` / RFC 7946 right-hand rule for GeoJSON exports.

### 4.2 Community / Enumerated & Crowdsourced Data Guardrails

1. **Sanitization & Bounds Validation on Ingestion**:
   - Raw field-enumerated or community-submitted coordinates (`longitude`, `latitude`) frequently contain `NULL`, `0, 0` ("Null Island"), swapped lat/lng, or GPS drift outside municipal boundaries.
   - During ETL or crowdsourced submission:
     - Reject or flag coordinates outside Philippine/LGU bounding boxes into `upload_batches.error_log` (never crash the batch).
     - Verify spatial containment against `barangays.geom_boundary` (`ST_Intersects(b.geom_boundary, h.geom_point)`) and flag cross-barangay GPS mismatches for review by `MUNICIPAL_STATISTICIAN`.
2. **Flat-to-Relational De-duplication & Multi-Year Isolation**:
   - Every CBMS household is uniquely scoped by `UNIQUE (survey_year_id, cbms_uuid)` and every member by `UNIQUE (household_id, line_number)`.
   - Never mix records across `survey_year_id` unless executing an explicit Year-over-Year (`YoY`) comparison query.
3. **Strict RBAC & PII / Waiver Enforcement**:
   - **Full Data Access**: `ADMIN`, `MUNICIPAL_STATISTICIAN`, `MPDC`.
   - **Restricted Access**: `STAFF` (and any unauthenticated/public context).
   - For `STAFF`, backend endpoints MUST redact `a01_last_name`, `a01_first_name`, `a01_middle_name`, `a01_suffix`, `husn`, `hsn`, `address_house_number`, and exact household coordinates, and MUST return `403 Forbidden` on individual beneficiary roster exports.
   - Respect `households.agree_to_sign_the_waiver` (CBMS Form 3 Consent, Column `122`).

---

## 5. Coding Constraints & Style (`ALWAYS` vs. `NEVER` Rules)

### `ALWAYS` Rules

- **ALWAYS use Dual-Mode Spatial Serving**:
  - Serve **Barangay/Municipal Choropleths** as **GeoJSON** (`ST_AsGeoJSON`) joined with `mv_barangay_yearly_indicators` (fast-path) or selective dynamic aggregations.
  - Serve **Household Points (`5,000–50,000+` features)** as binary **PostGIS Mapbox Vector Tiles (`ST_AsMVT`, `.pbf`)**.
- **ALWAYS prune unused CBMS Section Joins**:
  - Only `JOIN` the 1:1 household section tables (`Sections F–O + Poverty`) that are actively referenced in the filter or select list.
- **ALWAYS use `EXISTS` semijoins for Member-Level (`Sections A–E`) filters on Household queries**:
  - When filtering households by member attributes (e.g., `b10_pwd = 1` or `a05_age >= 60`), use `EXISTS (SELECT 1 FROM household_members hm JOIN ... WHERE hm.household_id = h.id AND ...)` so household counts and geometries are never multiplied by member rows.
- **ALWAYS dispose of MapLibre GL JS resources and abort stale requests**:
  - Pass `AbortSignal` from TanStack Query into `fetch` calls so rapid filter changes or map pans cancel in-flight spatial queries.
  - Clean up custom MapLibre event listeners, popup instances, draw controls (`@mapbox/mapbox-gl-draw`), and custom images/sources in React `useEffect` cleanup functions to prevent WebGL context and GPU buffer leaks.
- **ALWAYS stream large file uploads and exports**:
  - Process `.xlsx` and `.csv` uploads in bounded chunks (`1,000` rows per transaction) inside a Node `worker_threads` worker, and refresh `mv_barangay_yearly_indicators` `CONCURRENTLY` upon completion.
- **ALWAYS use stable React references for MapLibre props**:
  - Memoize GeoJSON `data`, `paint`, `layout`, and `filter` expressions (`useMemo` / module-level constants) passed to `<Source>` and `<Layer>` to prevent MapLibre from re-parsing and re-uploading geometry buffers to the GPU on every React render.

### `NEVER` Rules

- **NEVER send raw unpaginated GeoJSON for household points**:
  - Never return `SELECT ST_AsGeoJSON(geom_point) FROM households` for an entire municipality to the browser. High-density point layers must use `ST_AsMVT` vector tiles or server-side spatial clustering.
- **NEVER render thousands of DOM markers (`<Marker>`) in MapLibre**:
  - Never map over an array of households to render HTML `<Marker>` elements. Always use WebGL `<Source type="vector">` / `<Source type="geojson" cluster={true}>` with `<Layer type="circle" | "symbol" | "heatmap">`.
- **NEVER store GeoJSON objects in Zustand or React state when a URL/Tile source suffices**:
  - Keep large spatial payloads out of reactive UI state stores to avoid deep-clone garbage collection pauses and browser tab crashes.
- **NEVER execute a 15-table `LEFT JOIN` across all CBMS sections by default**:
  - Default views must hit `mv_barangay_yearly_indicators` or `households` + `household_poverty`.
- **NEVER concatenate raw filter strings into PostGIS SQL**:
  - Always use Kysely parameterized bindings (`sql` template tags) and validate column identifiers against the whitelist in `@cbms/shared` (`cbms-dictionary.ts`).
- **NEVER block the Node.js main event loop with synchronous spreadsheet parsing**:
  - Do not use synchronous `XLSX.readFile()` on 312-column CBMS datasets on the main Express thread.

---

## 6. Agent Output Format & Communication Contract

1. **Concise, High-Signal Technical Delivery**:
   - Omit conversational filler, lengthy preambles, and generic explanations of basic web concepts.
   - Lead directly with the architectural decision, SQL/PostGIS query, or TypeScript implementation.
2. **Prioritize Optimized Spatial SQL & Clean Geometry Code**:
   - When proposing database or API logic, provide exact, index-aware PostGIS SQL (`GiST`-backed predicates, `ST_AsMVT`, `FILTER (WHERE ...)` clauses, `EXISTS` semijoins) and strictly typed Kysely/TypeScript code.
3. **Explicit Performance & Memory Accounting**:
   - Briefly state the spatial index used (e.g., `idx_households_geom`, `idx_mv_brgy_yearly_pk`), the expected payload size (e.g., `MVT .pbf` vs `GeoJSON`), and how client-side WebGL memory cleanup is handled.
4. **Clickable File & Symbol References**:
   - Always link directly to workspace files and line ranges using `[basename](file:///D:/projects/lgeo-web-app/...)` format.

## 7. Mandatory Testing Workflow

1. **Always run tests:** Execute the full test suite before marking any task complete.
2. **Test-first for bug fixes:** Write a failing test that reproduces a bug before modifying application code.
3. **Cover new features:** Add unit and integration tests for all new functions, endpoints, or UI components.
4. **Fix failures immediately:** Never skip, comment out, or delete failing tests to make a build pass. Fix the underlying code or update outdated assertions properly.
