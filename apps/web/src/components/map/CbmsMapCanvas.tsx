import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MapLibreMap, {
  ScaleControl,
  Source,
  Layer,
  Popup,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  Copy,
  Check,
  Expand,
  Home,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Ruler,
  Search,
  Trash2,
  Undo2,
  Users,
  X,
  ChevronDown,
  ChevronUp,
  Box,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  HEADLINE_CHOROPLETH_METRICS,
  canAccessHouseholdData,
  canAccessMemberData,
  LANDMARK_SECTORS,
  type HeadlineChoroplethMetricId,
  type LandmarkCatchmentSummary,
} from "@cbms/shared";
import { useMapFilterStore } from "../../store/useMapFilterStore";
import {
  BASE_MAP_STYLE,
  BASEMAP_OPTIONS,
  getBasemapById,
} from "../../utils/basemaps";
import { maplibregl } from "../../utils/maplibreCompat";
import {
  computeGeodesicPolygonAreaSqMeters,
  computePolylineDistanceMeters,
  formatAreaMetric,
  formatCoordinate,
  formatDistanceMetric,
  parseCoordinateQuery,
} from "../../utils/geodesic";

interface HouseholdPopupMember {
  lineNumber: string;
  firstName: string;
  lastName: string;
  sex: "Male" | "Female";
  age: number;
  relationToHead: string;
  isPwd: boolean;
  isSeniorCitizen: boolean;
  isSoloParent: boolean;
  attendingSchool: boolean;
  occupation: string;
}

const DEFAULT_LNG = Number(import.meta.env.VITE_DEFAULT_MAP_LNG ?? 125.5825);
const DEFAULT_LAT = Number(import.meta.env.VITE_DEFAULT_MAP_LAT ?? 10.0115);
const DEFAULT_ZOOM = Number(import.meta.env.VITE_DEFAULT_MAP_ZOOM ?? 13.1);
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

// Bounding box of San Jose, Dinagat Islands (PSGC 1608506)
const SAN_JOSE_BOUNDS: [[number, number], [number, number]] = [
  [125.558, 9.989],
  [125.639, 10.051],
];

const COVERAGE_METRICS = new Set<HeadlineChoroplethMetricId>([
  "electricity_rate",
  "internet_rate",
  "beneficiary_4ps_rate",
]);

type FeatureLayerKind = "household" | "landmark" | "road" | "elu" | "barangay";

interface IdentifiedFeatureItem {
  layerType: FeatureLayerKind;
  layerLabel: string;
  title: string;
  properties: Record<string, unknown>;
}

interface MultiLayerSelection {
  longitude: number;
  latitude: number;
  activeIndex: number;
  items: IdentifiedFeatureItem[];
}

interface HoveredFeatureReadout {
  layerLabel: string;
  title: string;
  subtitle: string;
}

interface OmniboxSearchResult {
  id: string;
  category:
    | "Barangay"
    | "Facility"
    | "Road"
    | "Land Use"
    | "Household"
    | "Coordinates";
  title: string;
  subtitle: string;
  longitude: number;
  latitude: number;
  zoom: number;
  featureItem?: IdentifiedFeatureItem;
}

const CATCHMENT_FILL_PAINT: Record<string, unknown> = {
  "fill-color": "#f97316",
  "fill-opacity": 0.18,
};

const CATCHMENT_LINE_PAINT: Record<string, unknown> = {
  "line-color": "#fb923c",
  "line-width": 2.2,
  "line-dasharray": [2, 2],
};

const MEASURE_POLYGON_FILL_PAINT: Record<string, unknown> = {
  "fill-color": "#38bdf8",
  "fill-opacity": 0.2,
};

const MEASURE_LINE_PAINT: Record<string, unknown> = {
  "line-color": "#38bdf8",
  "line-width": 2.5,
  "line-dasharray": [2, 1.5],
};

const MEASURE_VERTEX_PAINT: Record<string, unknown> = {
  "circle-radius": 5,
  "circle-color": "#0284c7",
  "circle-stroke-width": 2,
  "circle-stroke-color": "#f8fafc",
};

export const CbmsMapCanvas: React.FC = () => {
  const mapRef = useRef<MapRef | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    surveyYear,
    selectedMetric,
    activeRole,
    basemapId,
    isSidebarCollapsed,
    isLegendCollapsed,
    showChoropleth,
    showBarangayLabels,
    showLandUse,
    showRoads,
    roadColorMode,
    showLandmarks,
    selectedLandmarkSector,
    showHouseholdPoints,
    layerOpacities,
    measureMode,
    coordFormat,
    activeCatchmentLandmarkId,
    catchmentRadiusMeters,
    activeVulnerabilityCriteria,
    dataRefreshVersion,
    setBasemapId,
    toggleSidebarCollapsed,
    toggleLegendCollapsed,
    setMeasureMode,
    toggleCoordFormat,
    setActiveCatchment,
  } = useMapFilterStore();

  const [viewState, setViewState] = useState({
    longitude: DEFAULT_LNG,
    latitude: DEFAULT_LAT,
    zoom: DEFAULT_ZOOM,
    pitch: 0,
    bearing: 0,
  });

  const [cursorCoords, setCursorCoords] = useState<{
    lng: number;
    lat: number;
  }>({
    lng: DEFAULT_LNG,
    lat: DEFAULT_LAT,
  });
  const [pinnedCoords, setPinnedCoords] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBasemapMenuOpen, setIsBasemapMenuOpen] = useState(false);

  // Hover & Multi-layer click inspection state
  const [hoveredReadout, setHoveredReadout] =
    useState<HoveredFeatureReadout | null>(null);
  const [selection, setSelection] = useState<MultiLayerSelection | null>(null);

  // Geodesic Measurement state
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measureCursor, setMeasureCursor] = useState<[number, number] | null>(
    null,
  );

  // Spatial Search Omnibox state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const canViewPoints = canAccessHouseholdData(activeRole);
  const canViewMembers = canAccessMemberData(activeRole);
  const activeBasemap = useMemo(() => getBasemapById(basemapId), [basemapId]);
  const isCoverageMetric = COVERAGE_METRICS.has(selectedMetric);
  const selectedMetricMeta = useMemo(
    () =>
      HEADLINE_CHOROPLETH_METRICS.find((m) => m.id === selectedMetric) ??
      HEADLINE_CHOROPLETH_METRICS[0]!,
    [selectedMetric],
  );

  // Sync fullscreen state with browser event
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Clear measurement points when switching measurement mode off
  const handleSelectMeasureMode = useCallback(
    (mode: "none" | "distance" | "area") => {
      const next = measureMode === mode ? "none" : mode;
      setMeasureMode(next);
      setMeasurePoints([]);
      setMeasureCursor(null);
      if (next !== "none") {
        setSelection(null);
      }
    },
    [measureMode, setMeasureMode],
  );

  // 1. Barangay Choropleth GeoJSON Query ( Always fetched so Search & KPIs work seamlessly )
  const choroplethQuery = useQuery({
    queryKey: ["gis-choropleth", surveyYear, dataRefreshVersion],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `${API_BASE}/gis/choropleth?surveyYear=${surveyYear}`,
        { signal },
      );
      if (!res.ok) throw new Error("Failed to load barangay choropleth");
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  // 2. Existing Land Use (ELU_SanJose) GeoJSON Query
  const landUseQuery = useQuery({
    queryKey: ["gis-land-use"],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/gis/land-use`, { signal });
      if (!res.ok) throw new Error("Failed to load land use zones");
      return res.json();
    },
    staleTime: Infinity,
  });

  // 3. Road Network (mun_sanjose_roads) GeoJSON Query
  const roadsQuery = useQuery({
    queryKey: ["gis-roads"],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/gis/roads`, { signal });
      if (!res.ok) throw new Error("Failed to load road networks");
      return res.json();
    },
    staleTime: Infinity,
  });

  // 4. Municipal Landmarks (mun_sanjose_landmark) GeoJSON Query
  const landmarksQuery = useQuery({
    queryKey: ["gis-landmarks", selectedLandmarkSector],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `${API_BASE}/gis/landmarks?sector=${encodeURIComponent(selectedLandmarkSector)}`,
        { signal },
      );
      if (!res.ok) throw new Error("Failed to load municipal landmarks");
      return res.json();
    },
    staleTime: Infinity,
  });

  // 5. Facility Service Catchment (ST_DWithin) Query
  const catchmentQuery = useQuery<LandmarkCatchmentSummary>({
    queryKey: [
      "gis-landmark-catchment",
      activeCatchmentLandmarkId,
      catchmentRadiusMeters,
      surveyYear,
    ],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `${API_BASE}/gis/landmarks/${activeCatchmentLandmarkId}/catchment?radiusMeters=${catchmentRadiusMeters}&surveyYear=${surveyYear}`,
        { signal },
      );
      if (!res.ok) throw new Error("Failed to compute facility catchment");
      return res.json();
    },
    enabled: activeCatchmentLandmarkId !== null,
  });

  // Live PostGIS Barangay polygons and CBMS indicators (returns 0 counts/rates when a year has 0 uploaded households)
  const enrichedChoroplethData = useMemo(() => {
    const raw = choroplethQuery.data;
    if (!raw?.features) return null;
    return raw;
  }, [choroplethQuery.data]);

  // Barangay Centroid Point FeatureCollection for crisp map labels
  const barangayLabelPoints = useMemo(() => {
    if (!enrichedChoroplethData?.features) return null;
    return {
      type: "FeatureCollection" as const,
      features: enrichedChoroplethData.features
        .filter(
          (f: { properties?: Record<string, unknown> }) =>
            f.properties?.labelLng != null && f.properties?.labelLat != null,
        )
        .map((f: { properties: Record<string, unknown> }) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [
              Number(f.properties.labelLng),
              Number(f.properties.labelLat),
            ],
          },
          properties: {
            barangayName: f.properties.barangayName,
            metricValue: `${Number(f.properties[selectedMetric] ?? 0).toFixed(1)}%`,
          },
        })),
    };
  }, [enrichedChoroplethData, selectedMetric]);

  // Municipal KPI Summary & Legend Scale Statistics
  const municipalStats = useMemo(() => {
    const features = enrichedChoroplethData?.features ?? [];
    if (features.length === 0) {
      return {
        totalHouseholds: 0,
        totalPopulation: 0,
        poorHouseholds: 0,
        minRate: 0,
        maxRate: 0,
        avgRate: 0,
      };
    }

    let totalHouseholds = 0;
    let totalPopulation = 0;
    let poorHouseholds = 0;
    let rateSum = 0;
    let minRate = Infinity;
    let maxRate = -Infinity;

    for (const f of features) {
      const p = f.properties ?? {};
      totalHouseholds += Number(p.totalHouseholds ?? 0);
      totalPopulation += Number(p.totalPopulation ?? 0);
      poorHouseholds += Number(p.poorHouseholds ?? 0);

      const val = Number(p[selectedMetric] ?? 0);
      rateSum += val;
      if (val < minRate) minRate = val;
      if (val > maxRate) maxRate = val;
    }

    return {
      totalHouseholds,
      totalPopulation,
      poorHouseholds,
      minRate: Number((minRate === Infinity ? 0 : minRate).toFixed(1)),
      maxRate: Number((maxRate === -Infinity ? 0 : maxRate).toFixed(1)),
      avgRate: Number((rateSum / features.length).toFixed(1)),
    };
  }, [enrichedChoroplethData, selectedMetric]);

  // Live PostGIS ST_DWithin facility service catchment stats
  const catchmentDisplayStats = useMemo(() => {
    const data = catchmentQuery.data;
    if (!data) return null;
    return data;
  }, [catchmentQuery.data]);

  // Interactive Layer IDs based on currently visible layers
  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = [];
    if (showHouseholdPoints && canViewPoints) {
      ids.push("household-points-layer");
    }
    if (showLandmarks) ids.push("landmarks-circle-layer");
    if (showRoads) ids.push("roads-line-layer");
    if (showLandUse) ids.push("elu-fill-layer");
    if (showChoropleth) ids.push("barangay-choropleth-fill");
    return ids;
  }, [
    showHouseholdPoints,
    canViewPoints,
    showLandmarks,
    showRoads,
    showLandUse,
    showChoropleth,
  ]);

  // Dynamic Paint Expressions (memoized for 60 FPS WebGL rendering)
  const eluFillPaint = useMemo<Record<string, unknown>>(
    () => ({
      "fill-color": [
        "match",
        ["get", "luCategory"],
        "Residential",
        "#facc15",
        "Commercial",
        "#ef4444",
        "Institutional",
        "#3b82f6",
        "Industrial",
        "#a855f7",
        "Infrastructure",
        "#64748b",
        "Agricultural (Production)",
        "#84cc16",
        "Agricultural (Protection)",
        "#65a30d",
        "Forestland",
        "#15803d",
        "Water (Protection)",
        "#06b6d4",
        "Water (Production)",
        "#0284c7",
        "Tourism",
        "#ec4899",
        "Parks/Playground",
        "#4ade80",
        "Cemetery",
        "#94a3b8",
        "Landfill",
        "#b45309",
        "#38bdf8",
      ],
      "fill-opacity": layerOpacities.landUse,
    }),
    [layerOpacities.landUse],
  );

  const eluOutlinePaint = useMemo<Record<string, unknown>>(
    () => ({
      "line-color": activeBasemap.isLight ? "#334155" : "#e2e8f0",
      "line-width": 0.9,
      "line-opacity": Math.min(1, layerOpacities.landUse + 0.15),
    }),
    [activeBasemap.isLight, layerOpacities.landUse],
  );

  const choroplethFillPaint = useMemo<Record<string, unknown>>(() => {
    const colorRamp = isCoverageMetric
      ? [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", selectedMetric], 0],
          0,
          "#1e293b",
          25,
          "#0891b2",
          50,
          "#14b8a6",
          75,
          "#10b981",
          95,
          "#047857",
        ]
      : [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", selectedMetric], 0],
          0,
          "#1e293b",
          15,
          "#fde047",
          28,
          "#f59e0b",
          40,
          "#ea580c",
          55,
          "#b91c1c",
        ];

    return {
      "fill-color": colorRamp,
      "fill-opacity": showLandUse
        ? Math.min(0.28, layerOpacities.choropleth)
        : layerOpacities.choropleth,
    };
  }, [
    isCoverageMetric,
    selectedMetric,
    showLandUse,
    layerOpacities.choropleth,
  ]);

  const barangayBoundaryPaint = useMemo<Record<string, unknown>>(
    () => ({
      "line-color": activeBasemap.isLight ? "#0369a1" : "#38bdf8",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.4, 15, 2.8],
      "line-dasharray": [2.5, 1.5],
      "line-opacity": 0.92,
    }),
    [activeBasemap.isLight],
  );

  const barangayLabelLayout = useMemo<Record<string, unknown>>(
    () => ({
      "text-field": [
        "format",
        ["get", "barangayName"],
        { "font-scale": 1.0 },
        "\n",
        {},
        ["get", "metricValue"],
        { "font-scale": 0.85 },
      ],
      "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 13],
      "text-anchor": "center",
      "text-allow-overlap": false,
    }),
    [],
  );

  const barangayLabelPaint = useMemo<Record<string, unknown>>(
    () => ({
      "text-color": activeBasemap.isLight ? "#0f172a" : "#f8fafc",
      "text-halo-color": activeBasemap.isLight ? "#ffffff" : "#020617",
      "text-halo-width": 1.8,
    }),
    [activeBasemap.isLight],
  );

  const roadCasingPaint = useMemo<Record<string, unknown>>(
    () => ({
      "line-color": activeBasemap.isLight ? "#1e293b" : "#020617",
      "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.5, 16, 7],
      "line-opacity": Math.min(1, layerOpacities.roads * 0.9),
    }),
    [activeBasemap.isLight, layerOpacities.roads],
  );

  const roadLinePaint = useMemo<Record<string, unknown>>(() => {
    if (roadColorMode === "condition") {
      return {
        "line-color": [
          "match",
          ["get", "roadCondition"],
          "Good",
          "#22c55e",
          "Fair",
          "#eab308",
          "Passable",
          "#f59e0b",
          "Poor",
          "#f97316",
          "Bad",
          "#ef4444",
          "#94a3b8",
        ],
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.6, 16, 4.8],
        "line-opacity": layerOpacities.roads,
      };
    }

    return {
      "line-color": [
        "match",
        ["get", "roadClass"],
        "National",
        "#facc15",
        "Provincial",
        "#fb923c",
        "Municipal",
        "#38bdf8",
        "Barangay",
        "#cbd5e1",
        "Stairway",
        "#a855f7",
        "#94a3b8",
      ],
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        11,
        [
          "match",
          ["get", "roadClass"],
          "National",
          3.2,
          "Provincial",
          2.5,
          1.4,
        ],
        16,
        [
          "match",
          ["get", "roadClass"],
          "National",
          6.8,
          "Provincial",
          5.2,
          3.2,
        ],
      ],
      "line-opacity": layerOpacities.roads,
    };
  }, [roadColorMode, layerOpacities.roads]);

  const landmarkCirclePaint = useMemo<Record<string, unknown>>(
    () => ({
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4.5, 16, 8.5],
      "circle-color": [
        "match",
        ["get", "sectorCategory"],
        "HEALTH_WELFARE",
        "#f43f5e",
        "DRRM_EVACUATION",
        "#f97316",
        "EDUCATION",
        "#3b82f6",
        "GOVERNANCE",
        "#10b981",
        "TRANSPORT_LIFELINES",
        "#06b6d4",
        "COMMERCE_ENVIRONMENT",
        "#a855f7",
        "#f8fafc",
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": activeBasemap.isLight ? "#ffffff" : "#0f172a",
      "circle-opacity": layerOpacities.landmarks,
    }),
    [activeBasemap.isLight, layerOpacities.landmarks],
  );

  const landmarkLabelLayout = useMemo<Record<string, unknown>>(
    () => ({
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-offset": [0, 1.15],
      "text-anchor": "top",
      "text-optional": true,
    }),
    [],
  );

  const landmarkLabelPaint = useMemo<Record<string, unknown>>(
    () => ({
      "text-color": activeBasemap.isLight ? "#0f172a" : "#f8fafc",
      "text-halo-color": activeBasemap.isLight ? "#ffffff" : "#020617",
      "text-halo-width": 1.5,
    }),
    [activeBasemap.isLight],
  );

  const householdPointsPaint = useMemo<Record<string, unknown>>(
    () => ({
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 16, 7.5],
      "circle-color": [
        "case",
        ["==", ["get", "poor"], 1],
        "#ef4444",
        "#22c55e",
      ],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": activeBasemap.isLight ? "#ffffff" : "#0f172a",
      "circle-opacity": layerOpacities.households,
    }),
    [activeBasemap.isLight, layerOpacities.households],
  );

  const catchmentFeatureCollection = useMemo(() => {
    if (!catchmentQuery.data?.bufferGeoJson) return null;
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: catchmentQuery.data.bufferGeoJson,
          properties: {
            radiusMeters: catchmentQuery.data.radiusMeters,
          },
        },
      ],
    };
  }, [catchmentQuery.data]);

  // Geodesic Measurement GeoJSON Overlay
  const measureGeoJson = useMemo(() => {
    const features: Record<string, unknown>[] = [];
    const activePts =
      measureCursor && measurePoints.length > 0
        ? [...measurePoints, measureCursor]
        : measurePoints;

    if (measureMode === "area" && activePts.length >= 3) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[...activePts, activePts[0]!]],
        },
        properties: { kind: "polygon" },
      });
    }

    if (activePts.length >= 2) {
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates:
            measureMode === "area" && activePts.length >= 3
              ? [...activePts, activePts[0]!]
              : activePts,
        },
        properties: { kind: "line" },
      });
    }

    for (const pt of measurePoints) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: pt,
        },
        properties: { kind: "vertex" },
      });
    }

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [measureMode, measurePoints, measureCursor]);

  const measurementSummary = useMemo(() => {
    if (measureMode === "distance") {
      const meters = computePolylineDistanceMeters(measurePoints);
      return {
        primary: formatDistanceMetric(meters),
        secondary: `${measurePoints.length} vertices`,
      };
    }
    if (measureMode === "area") {
      const sqMeters = computeGeodesicPolygonAreaSqMeters(measurePoints);
      const formatted = formatAreaMetric(sqMeters);
      return {
        primary: formatted.hectares,
        secondary: `${formatted.sqMeters} • ${measurePoints.length} vertices`,
      };
    }
    return null;
  }, [measureMode, measurePoints]);

  const mvtTiles = useMemo(() => {
    const baseUrl = API_BASE.startsWith("http")
      ? API_BASE
      : `${window.location.origin}${API_BASE.startsWith("/") ? "" : "/"}${API_BASE}`;
    return [
      `${baseUrl}/gis/tiles/households/{z}/{x}/{y}.pbf?surveyYear=${surveyYear}&v=${dataRefreshVersion}`,
    ];
  }, [surveyYear, dataRefreshVersion]);

  // GPU-accelerated MapLibre filter expression for CBMS Multi-Section Vulnerability Criteria (Sections A–O + Poverty)
  const householdVulnerabilityFilter = useMemo<unknown[] | undefined>(() => {
    if (activeVulnerabilityCriteria.length === 0) return undefined;
    const clauses: unknown[] = ["all"];
    for (const crit of activeVulnerabilityCriteria) {
      switch (crit) {
        case "poor":
          clauses.push(["==", ["get", "poor"], 1]);
          break;
        case "near_poor_5":
          clauses.push(["==", ["get", "nearPoor5"], 1]);
          break;
        case "senior_citizen":
          clauses.push(["==", ["get", "hasSenior"], 1]);
          break;
        case "pwd":
          clauses.push(["==", ["get", "hasPwd"], 1]);
          break;
        case "solo_parent":
          clauses.push(["==", ["get", "hasSoloParent"], 1]);
          break;
        case "food_insecure":
          clauses.push(["==", ["get", "foodInsecure"], 1]);
          break;
        case "no_4ps_poor":
          clauses.push(["==", ["get", "poor"], 1]);
          clauses.push(["==", ["get", "fourPsBeneficiary"], 0]);
          break;
        case "unimproved_water":
          clauses.push(["==", ["get", "unimprovedWater"], 1]);
          break;
        case "makeshift_housing":
          clauses.push(["==", ["get", "makeshiftHousing"], 1]);
          break;
        case "no_electricity":
          clauses.push(["==", ["get", "electricity"], 0]);
          break;
        case "no_internet":
          clauses.push(["==", ["get", "internetAtHome"], 0]);
          break;
        case "disaster_shock":
          clauses.push(["==", ["get", "disasterShock"], 1]);
          break;
      }
    }
    return clauses.length > 1 ? clauses : undefined;
  }, [activeVulnerabilityCriteria]);

  // Unified Spatial Omnibox Search Results
  const searchResults = useMemo<OmniboxSearchResult[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const results: OmniboxSearchResult[] = [];

    // 1. Direct Coordinate Search ([lat, lng] or [lng, lat] within PH bounds)
    const parsedCoord = parseCoordinateQuery(searchQuery);
    if (parsedCoord) {
      results.push({
        id: `coord-${parsedCoord.lng}-${parsedCoord.lat}`,
        category: "Coordinates",
        title: `${parsedCoord.lat.toFixed(5)}° N, ${parsedCoord.lng.toFixed(5)}° E`,
        subtitle: "WGS84 (EPSG:4326) Direct Coordinate Jump",
        longitude: parsedCoord.lng,
        latitude: parsedCoord.lat,
        zoom: 16,
      });
    }

    // 2. Barangays (12)
    for (const f of enrichedChoroplethData?.features ?? []) {
      const p = f.properties ?? {};
      const name = String(p.barangayName ?? "");
      const code = String(p.barangayGeoCode ?? "");
      if (name.toLowerCase().includes(q) || code.includes(q)) {
        const lng = Number(p.labelLng ?? DEFAULT_LNG);
        const lat = Number(p.labelLat ?? DEFAULT_LAT);
        results.push({
          id: `brgy-${code}`,
          category: "Barangay",
          title: `Barangay ${name}`,
          subtitle: `PSGC ${code} • ${p.totalHouseholds ?? 0} HH • Poverty ${p.poor_rate ?? 0}%`,
          longitude: lng,
          latitude: lat,
          zoom: 14.6,
          featureItem: {
            layerType: "barangay",
            layerLabel: "Barangay",
            title: `Barangay ${name}`,
            properties: p,
          },
        });
      }
    }

    // 3. Municipal Landmarks (124)
    for (const f of landmarksQuery.data?.features ?? []) {
      const p = f.properties ?? {};
      const name = String(p.name ?? "");
      const type = String(p.landmarkType ?? "");
      const brgy = String(p.barangayName ?? "San Jose");
      if (
        name.toLowerCase().includes(q) ||
        type.toLowerCase().includes(q) ||
        brgy.toLowerCase().includes(q)
      ) {
        const coords = f.geometry?.coordinates;
        const lng = Array.isArray(coords)
          ? Number(coords[0])
          : Number(p.longitude ?? DEFAULT_LNG);
        const lat = Array.isArray(coords)
          ? Number(coords[1])
          : Number(p.latitude ?? DEFAULT_LAT);
        results.push({
          id: `lmk-${p.id}`,
          category: "Facility",
          title: name,
          subtitle: `${type} • Brgy. ${brgy}`,
          longitude: lng,
          latitude: lat,
          zoom: 16.2,
          featureItem: {
            layerType: "landmark",
            layerLabel: "Facility",
            title: name,
            properties: {
              ...p,
              longitude: lng,
              latitude: lat,
            },
          },
        });
      }
    }

    // 4. Road Networks (239)
    for (const f of roadsQuery.data?.features ?? []) {
      const p = f.properties ?? {};
      const roadName = String(p.roadName ?? "");
      const roadClass = String(p.roadClass ?? "");
      if (
        roadName.toLowerCase().includes(q) ||
        roadClass.toLowerCase().includes(q)
      ) {
        const firstCoord = f.geometry?.coordinates?.[0]?.[0];
        const lng = Array.isArray(firstCoord)
          ? Number(firstCoord[0])
          : DEFAULT_LNG;
        const lat = Array.isArray(firstCoord)
          ? Number(firstCoord[1])
          : DEFAULT_LAT;
        results.push({
          id: `road-${p.id}`,
          category: "Road",
          title: roadName,
          subtitle: `${roadClass} Road • ${p.surfaceType} (${p.roadCondition}) • ${p.lengthMeters}m`,
          longitude: lng,
          latitude: lat,
          zoom: 15.8,
          featureItem: {
            layerType: "road",
            layerLabel: "Road",
            title: roadName,
            properties: p,
          },
        });
      }
    }

    // 5. Land Use Zones (26)
    for (const f of landUseQuery.data?.features ?? []) {
      const p = f.properties ?? {};
      const luName = String(p.luName ?? "");
      const luCat = String(p.luCategory ?? "");
      if (luName.toLowerCase().includes(q) || luCat.toLowerCase().includes(q)) {
        const firstCoord = f.geometry?.coordinates?.[0]?.[0]?.[0];
        const lng = Array.isArray(firstCoord)
          ? Number(firstCoord[0])
          : DEFAULT_LNG;
        const lat = Array.isArray(firstCoord)
          ? Number(firstCoord[1])
          : DEFAULT_LAT;
        results.push({
          id: `elu-${p.id}`,
          category: "Land Use",
          title: luName,
          subtitle: `CLUP ${luCat} • ${p.areaHectares} ha`,
          longitude: lng,
          latitude: lat,
          zoom: 14.8,
          featureItem: {
            layerType: "elu",
            layerLabel: "Land Use",
            title: luName,
            properties: p,
          },
        });
      }
    }

    return results.slice(0, 10);
  }, [
    searchQuery,
    enrichedChoroplethData,
    landmarksQuery.data,
    roadsQuery.data,
    landUseQuery.data,
  ]);

  const handleSelectSearchResult = useCallback((item: OmniboxSearchResult) => {
    setPinnedCoords({ lng: item.longitude, lat: item.latitude });
    if (item.featureItem) {
      setSelection({
        longitude: item.longitude,
        latitude: item.latitude,
        activeIndex: 0,
        items: [item.featureItem],
      });
    }
    setIsSearchFocused(false);

    requestAnimationFrame(() => {
      mapRef.current?.flyTo({
        center: [item.longitude, item.latitude],
        zoom: item.zoom,
        duration: 1100,
      });
    });
  }, []);

  // Map Navigation Helper Actions
  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 250 });
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 250 });
  }, []);

  const handleResetNorthPitch = useCallback(() => {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 400 });
  }, []);

  const handleToggle3DPitch = useCallback(() => {
    const nextPitch = viewState.pitch > 15 ? 0 : 50;
    mapRef.current?.easeTo({ pitch: nextPitch, duration: 450 });
  }, [viewState.pitch]);

  const handleFitSanJoseExtent = useCallback(() => {
    mapRef.current?.fitBounds(SAN_JOSE_BOUNDS, {
      padding: 48,
      pitch: 0,
      bearing: 0,
      duration: 900,
    });
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    } else {
      await document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const handleCopyCoordinates = useCallback(() => {
    const target = pinnedCoords ?? cursorCoords;
    const formatted = formatCoordinate(target.lng, target.lat, coordFormat);
    navigator.clipboard?.writeText(formatted.combined).catch(() => undefined);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 1800);
  }, [pinnedCoords, cursorCoords, coordFormat]);

  // Mouse Move Handler: Live Coordinate Telemetry + Hover Feature Readout + Geodesic Rubber-band
  const handleMouseMove = useCallback(
    (evt: MapLayerMouseEvent) => {
      const { lng, lat } = evt.lngLat;
      setCursorCoords({ lng, lat });

      if (measureMode !== "none") {
        setMeasureCursor([lng, lat]);
      }

      const top = evt.features?.[0];
      if (!top) {
        setHoveredReadout(null);
        return;
      }

      const lid = top.layer.id;
      const p = (top.properties ?? {}) as Record<string, unknown>;

      if (
        lid === "sample-household-points-layer" ||
        lid === "household-points-layer"
      ) {
        setHoveredReadout({
          layerLabel: "Household",
          title: `HH ${String(p.hsn ?? p.household_id ?? "")}`,
          subtitle: `Brgy. ${String(p.barangayName ?? "San Jose")} • ${Number(p.poor) === 1 ? "Poor" : "Non-Poor"}`,
        });
      } else if (lid === "landmarks-circle-layer") {
        setHoveredReadout({
          layerLabel: String(p.landmarkType ?? "Facility"),
          title: String(p.name ?? "Facility"),
          subtitle: `Brgy. ${String(p.barangayName ?? "San Jose")}`,
        });
      } else if (lid === "roads-line-layer") {
        setHoveredReadout({
          layerLabel: `${String(p.roadClass ?? "")} Road`,
          title: String(p.roadName ?? "Road Segment"),
          subtitle: `${String(p.surfaceType ?? "")} • ${String(p.roadCondition ?? "")} (${String(p.lengthMeters ?? 0)}m)`,
        });
      } else if (lid === "elu-fill-layer") {
        setHoveredReadout({
          layerLabel: "Land Use (ELU)",
          title: String(p.luName ?? "Zone"),
          subtitle: `${String(p.luCategory ?? "")} • ${String(p.areaHectares ?? 0)} ha`,
        });
      } else if (lid === "barangay-choropleth-fill") {
        setHoveredReadout({
          layerLabel: "Barangay",
          title: `Brgy. ${String(p.barangayName ?? "")}`,
          subtitle: `${selectedMetricMeta.label}: ${Number(p[selectedMetric] ?? 0).toFixed(1)}%`,
        });
      }
    },
    [measureMode, selectedMetric, selectedMetricMeta.label],
  );

  // Map Click Handler: Geodesic Measurement Vertex OR Multi-Layer Feature Disambiguation
  const handleMapClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const { lng, lat } = evt.lngLat;

      if (measureMode !== "none") {
        setMeasurePoints((prev) => [...prev, [lng, lat]]);
        return;
      }

      const rawFeatures = evt.features ?? [];
      if (rawFeatures.length === 0) {
        setSelection(null);
        return;
      }

      const seenKinds = new Set<FeatureLayerKind>();
      const items: IdentifiedFeatureItem[] = [];

      for (const f of rawFeatures) {
        const lid = f.layer.id;
        const props = (f.properties ?? {}) as Record<string, unknown>;

        if (
          (lid === "sample-household-points-layer" ||
            lid === "household-points-layer") &&
          !seenKinds.has("household")
        ) {
          seenKinds.add("household");
          items.push({
            layerType: "household",
            layerLabel: "Household",
            title: `HH ${String(props.hsn ?? props.id ?? "")}`,
            properties: props,
          });
        } else if (
          lid === "landmarks-circle-layer" &&
          !seenKinds.has("landmark")
        ) {
          seenKinds.add("landmark");
          items.push({
            layerType: "landmark",
            layerLabel: "Facility",
            title: String(props.name ?? "Facility"),
            properties: props,
          });
        } else if (lid === "roads-line-layer" && !seenKinds.has("road")) {
          seenKinds.add("road");
          items.push({
            layerType: "road",
            layerLabel: "Road",
            title: String(props.roadName ?? "Road Segment"),
            properties: props,
          });
        } else if (lid === "elu-fill-layer" && !seenKinds.has("elu")) {
          seenKinds.add("elu");
          items.push({
            layerType: "elu",
            layerLabel: "Land Use",
            title: String(props.luName ?? "Land Use Zone"),
            properties: props,
          });
        } else if (
          lid === "barangay-choropleth-fill" &&
          !seenKinds.has("barangay")
        ) {
          seenKinds.add("barangay");
          items.push({
            layerType: "barangay",
            layerLabel: "Barangay",
            title: `Brgy. ${String(props.barangayName ?? "")}`,
            properties: props,
          });
        }
      }

      if (items.length > 0) {
        setPinnedCoords({ lng, lat });
        setSelection({
          longitude: lng,
          latitude: lat,
          activeIndex: 0,
          items,
        });
      } else {
        setSelection(null);
      }
    },
    [measureMode],
  );

  const activeFeature = selection?.items[selection.activeIndex] ?? null;
  const activeHouseholdMembers = useMemo<HouseholdPopupMember[]>(() => {
    if (activeFeature?.layerType !== "household") return [];
    const props = activeFeature.properties;

    if (typeof props.membersJson === "string") {
      try {
        const parsedMembers = JSON.parse(props.membersJson);
        if (Array.isArray(parsedMembers)) {
          return parsedMembers as HouseholdPopupMember[];
        }
      } catch {
        return [];
      }
    }
    return [];
  }, [activeFeature]);

  const activeCoordReadout = useMemo(
    () => formatCoordinate(cursorCoords.lng, cursorCoords.lat, coordFormat),
    [cursorCoords.lng, cursorCoords.lat, coordFormat],
  );

  const mapCursor = useMemo(() => {
    if (measureMode !== "none") return "crosshair";
    if (hoveredReadout) return "pointer";
    return "grab";
  }, [measureMode, hoveredReadout]);

  const syncBasemapLayers = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    try {
      for (const opt of BASEMAP_OPTIONS) {
        const layerId = `basemap-layer-${opt.id}`;
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(
            layerId,
            "visibility",
            opt.id === basemapId ? "visible" : "none",
          );
        }
      }
      if (map.getLayer("basemap-layer-satellite-labels")) {
        map.setLayoutProperty(
          "basemap-layer-satellite-labels",
          "visibility",
          basemapId === "satellite" ? "visible" : "none",
        );
      }
    } catch {
      // Ignore if map style hasn't finished initial load yet
    }
  }, [basemapId]);

  useEffect(() => {
    syncBasemapLayers();
  }, [syncBasemapLayers]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden"
    >
      <MapLibreMap
        ref={mapRef}
        mapLib={maplibregl as never}
        {...viewState}
        cursor={mapCursor}
        onLoad={syncBasemapLayers}
        onMove={(evt) => setViewState(evt.viewState)}
        onMouseMove={handleMouseMove}
        onClick={handleMapClick}
        interactiveLayerIds={interactiveLayerIds}
        mapStyle={
          BASE_MAP_STYLE as React.ComponentProps<typeof MapLibreMap>["mapStyle"]
        }
        style={{ width: "100%", height: "100%" }}
      >
        <ScaleControl position="bottom-right" maxWidth={110} unit="metric" />

        {/* 1. Existing Land Use (ELU_SanJose) MultiPolygon Layer */}
        {showLandUse && landUseQuery.data && (
          <Source
            id="cbms-land-use-source"
            type="geojson"
            data={landUseQuery.data}
          >
            <Layer
              id="elu-fill-layer"
              type="fill"
              beforeId="cbms-slot-landuse"
              paint={eluFillPaint as never}
            />
            <Layer
              id="elu-outline-layer"
              type="line"
              beforeId="cbms-slot-landuse"
              paint={eluOutlinePaint as never}
            />
          </Source>
        )}

        {/* 2. Barangay Choropleth & Administrative Boundaries Layer */}
        {showChoropleth && enrichedChoroplethData && (
          <Source
            id="cbms-choropleth-source"
            type="geojson"
            data={enrichedChoroplethData}
          >
            <Layer
              id="barangay-choropleth-fill"
              type="fill"
              beforeId="cbms-slot-choropleth"
              paint={choroplethFillPaint as never}
            />
            <Layer
              id="barangay-boundary-line"
              type="line"
              beforeId="cbms-slot-choropleth"
              paint={barangayBoundaryPaint as never}
            />
          </Source>
        )}

        {/* 3. Municipal Road Network (mun_sanjose_roads) MultiLineString Layer */}
        {showRoads && roadsQuery.data && (
          <Source id="cbms-roads-source" type="geojson" data={roadsQuery.data}>
            <Layer
              id="roads-casing-layer"
              type="line"
              beforeId="cbms-slot-roads"
              paint={roadCasingPaint as never}
            />
            <Layer
              id="roads-line-layer"
              type="line"
              beforeId="cbms-slot-roads"
              paint={roadLinePaint as never}
            />
          </Source>
        )}

        {/* 4. Active Landmark Metric Catchment Buffer (PostGIS ST_DWithin / ST_Buffer) */}
        {catchmentFeatureCollection && (
          <Source
            id="cbms-landmark-catchment-source"
            type="geojson"
            data={catchmentFeatureCollection as never}
          >
            <Layer
              id="catchment-buffer-fill"
              type="fill"
              beforeId="cbms-slot-catchment"
              paint={CATCHMENT_FILL_PAINT as never}
            />
            <Layer
              id="catchment-buffer-line"
              type="line"
              beforeId="cbms-slot-catchment"
              paint={CATCHMENT_LINE_PAINT as never}
            />
          </Source>
        )}

        {/* 4B. Barangay Centroid Labels + Metric Readout */}
        {showChoropleth && showBarangayLabels && barangayLabelPoints && (
          <Source
            id="cbms-barangay-labels-source"
            type="geojson"
            data={barangayLabelPoints}
          >
            <Layer
              id="barangay-label-layer"
              type="symbol"
              beforeId="cbms-slot-barangay-labels"
              layout={barangayLabelLayout as never}
              paint={barangayLabelPaint as never}
            />
          </Source>
        )}

        {/* 5. Household GPS Points (PostGIS ST_AsMVT + Frontend Sample Data inside San Jose) */}
        {showHouseholdPoints && canViewPoints && (
          <>
            <Source
              id="cbms-households-mvt"
              type="vector"
              tiles={mvtTiles}
              minzoom={10}
              maxzoom={18}
            >
              <Layer
                id="household-points-layer"
                type="circle"
                source-layer="households"
                beforeId="cbms-slot-households"
                filter={(householdVulnerabilityFilter ?? ["all"]) as never}
                paint={householdPointsPaint as never}
              />
            </Source>
          </>
        )}

        {/* 6. Municipal Landmarks & Critical Facilities (mun_sanjose_landmark) Point Layer */}
        {showLandmarks && landmarksQuery.data && (
          <Source
            id="cbms-landmarks-source"
            type="geojson"
            data={landmarksQuery.data}
          >
            <Layer
              id="landmarks-circle-layer"
              type="circle"
              beforeId="cbms-slot-landmarks"
              paint={landmarkCirclePaint as never}
            />
            <Layer
              id="landmarks-label-layer"
              type="symbol"
              minzoom={13.2}
              beforeId="cbms-slot-landmarks"
              layout={landmarkLabelLayout as never}
              paint={landmarkLabelPaint as never}
            />
          </Source>
        )}

        {/* 7. Interactive Geodesic Measurement Layer (Distance & Area) */}
        {measureMode !== "none" && (
          <Source
            id="cbms-measure-source"
            type="geojson"
            data={measureGeoJson as never}
          >
            <Layer
              id="measure-polygon-fill"
              type="fill"
              beforeId="cbms-slot-measure"
              filter={["==", ["get", "kind"], "polygon"] as never}
              paint={MEASURE_POLYGON_FILL_PAINT as never}
            />
            <Layer
              id="measure-line"
              type="line"
              beforeId="cbms-slot-measure"
              filter={["==", ["get", "kind"], "line"] as never}
              paint={MEASURE_LINE_PAINT as never}
            />
            <Layer
              id="measure-vertices"
              type="circle"
              beforeId="cbms-slot-measure"
              filter={["==", ["get", "kind"], "vertex"] as never}
              paint={MEASURE_VERTEX_PAINT as never}
            />
          </Source>
        )}

        {/* Multi-Layer Feature Identification Popup */}
        {selection && activeFeature && (
          <Popup
            longitude={selection.longitude}
            latitude={selection.latitude}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            onClose={() => setSelection(null)}
            maxWidth="360px"
          >
            <div className="min-w-[270px] p-1 text-xs text-slate-900">
              {/* Popup Top Bar: Layer Tabs / Label + Explicit Close Button */}
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                {selection.items.length > 1 ? (
                  <div className="flex flex-wrap gap-1">
                    {selection.items.map((item, idx) => (
                      <button
                        key={`${item.layerType}-${idx}`}
                        type="button"
                        onClick={() =>
                          setSelection((prev) =>
                            prev ? { ...prev, activeIndex: idx } : null,
                          )
                        }
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                          selection.activeIndex === idx
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {item.layerLabel}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {activeFeature.layerLabel} Inspector
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setSelection(null)}
                  title="Close Popup"
                  aria-label="Close Popup"
                  className="ml-auto inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 transition hover:bg-red-100 hover:text-red-700"
                >
                  <X className="h-3 w-3" />
                  <span>Close</span>
                </button>
              </div>

              {/* A. Landmark / Critical Facility Inspector */}
              {activeFeature.layerType === "landmark" && (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="rounded bg-orange-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {String(
                        activeFeature.properties.landmarkType ?? "Facility",
                      )}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      Brgy.{" "}
                      {String(
                        activeFeature.properties.barangayName ?? "San Jose",
                      )}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {String(activeFeature.properties.name ?? "Facility")}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Coords:{" "}
                    {Number(
                      activeFeature.properties.latitude ?? selection.latitude,
                    ).toFixed(5)}
                    °N,{" "}
                    {Number(
                      activeFeature.properties.longitude ?? selection.longitude,
                    ).toFixed(5)}
                    °E
                  </p>

                  {/* 1-Click PostGIS Service Catchment Buffer Controls */}
                  <div className="mt-2.5 border-t border-slate-200 pt-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Service Catchment Buffer (ST_DWithin):
                    </p>
                    <div className="flex gap-1">
                      {[250, 500, 1000].map((radius) => {
                        const lmkId = Number(activeFeature.properties.id);
                        const isActive =
                          activeCatchmentLandmarkId === lmkId &&
                          catchmentRadiusMeters === radius;
                        return (
                          <button
                            key={radius}
                            type="button"
                            onClick={() => setActiveCatchment(lmkId, radius)}
                            className={`rounded px-2.5 py-1 text-[10px] font-semibold transition ${
                              isActive
                                ? "bg-orange-600 text-white shadow-sm"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {radius}m
                          </button>
                        );
                      })}
                      {activeCatchmentLandmarkId !== null && (
                        <button
                          type="button"
                          onClick={() => setActiveCatchment(null)}
                          className="rounded bg-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-300"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {catchmentDisplayStats &&
                      catchmentDisplayStats.landmarkId ===
                        Number(activeFeature.properties.id) && (
                        <div className="mt-2 rounded-md border border-orange-200 bg-orange-50/90 p-2 text-[11px] text-slate-800">
                          <div className="mb-1 flex items-center justify-between">
                            <strong>
                              {catchmentDisplayStats.radiusMeters}m Catchment
                            </strong>
                            <span className="text-[10px] text-orange-700">
                              {surveyYear} (PostGIS)
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-center">
                            <div className="rounded bg-white p-1">
                              <div className="text-[10px] text-slate-500">
                                Households
                              </div>
                              <div className="font-bold text-slate-900">
                                {catchmentDisplayStats.householdsInRadius}
                              </div>
                            </div>
                            <div className="rounded bg-white p-1">
                              <div className="text-[10px] text-slate-500">
                                Population
                              </div>
                              <div className="font-bold text-slate-900">
                                {catchmentDisplayStats.populationInRadius}
                              </div>
                            </div>
                            <div className="rounded bg-white p-1">
                              <div className="text-[10px] text-slate-500">
                                Poor HH
                              </div>
                              <div className="font-bold text-red-600">
                                {catchmentDisplayStats.poorHouseholdsInRadius}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* B. Road Network Segment Inspector */}
              {activeFeature.layerType === "road" && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="rounded bg-sky-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {String(activeFeature.properties.roadClass ?? "Road")}{" "}
                      Road
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Brgy.{" "}
                      {String(
                        activeFeature.properties.barangayName ?? "San Jose",
                      )}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {String(
                      activeFeature.properties.roadName ?? "Road Segment",
                    )}
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded bg-slate-100 p-2 text-[11px] text-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-500">
                        Surface:
                      </span>{" "}
                      <strong className="block">
                        {String(activeFeature.properties.surfaceType)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">
                        Condition:
                      </span>{" "}
                      <strong className="block">
                        {String(activeFeature.properties.roadCondition)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">
                        Metric Length:
                      </span>{" "}
                      <strong className="block">
                        {String(activeFeature.properties.lengthMeters)} m
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Width:</span>{" "}
                      <strong className="block">
                        {activeFeature.properties.widthMeters
                          ? `${String(activeFeature.properties.widthMeters)} m`
                          : "Standard"}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* C. Existing Land Use (ELU) Zone Inspector */}
              {activeFeature.layerType === "elu" && (
                <div>
                  <span className="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    CLUP Land Use Zone
                  </span>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {String(activeFeature.properties.luName)}
                  </p>
                  <div className="mt-1.5 space-y-1 rounded bg-slate-100 p-2 text-[11px] text-slate-700">
                    <div>
                      Macro Category:{" "}
                      <strong>
                        {String(activeFeature.properties.luCategory)}
                      </strong>
                    </div>
                    <div>
                      Total Area:{" "}
                      <strong>
                        {String(activeFeature.properties.areaHectares)} ha
                      </strong>
                    </div>
                    <div>
                      Perimeter:{" "}
                      <strong>
                        {String(activeFeature.properties.perimeterLength)} m
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* D. Barangay Choropleth Summary Inspector */}
              {activeFeature.layerType === "barangay" && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="rounded bg-indigo-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      PSGC {String(activeFeature.properties.barangayGeoCode)}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      {surveyYear} CBMS
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    Barangay {String(activeFeature.properties.barangayName)}
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded bg-slate-100 p-2 text-[11px] text-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-500">
                        Households
                      </span>
                      <strong className="block text-slate-900">
                        {Number(
                          activeFeature.properties.totalHouseholds ?? 0,
                        ).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">
                        Population
                      </span>
                      <strong className="block text-slate-900">
                        {Number(
                          activeFeature.properties.totalPopulation ?? 0,
                        ).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">
                        Poverty Rate
                      </span>
                      <strong className="block text-red-600">
                        {String(activeFeature.properties.poor_rate ?? 0)}%
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">
                        Electricity / Net
                      </span>
                      <strong className="block text-emerald-700">
                        {String(activeFeature.properties.electricity_rate ?? 0)}
                        % /{" "}
                        {String(activeFeature.properties.internet_rate ?? 0)}%
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* E. CBMS Household & Member Roster Inspector (RBAC-Protected) */}
              {activeFeature.layerType === "household" && (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${
                        Number(activeFeature.properties.poor) === 1
                          ? "bg-red-600"
                          : "bg-emerald-600"
                      }`}
                    >
                      {Number(activeFeature.properties.poor) === 1
                        ? "Poor Household"
                        : "Non-Poor Household"}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      Brgy.{" "}
                      {String(
                        activeFeature.properties.barangayName ?? "San Jose",
                      )}
                    </span>
                  </div>

                  {canViewPoints ? (
                    <>
                      <p className="text-sm font-bold text-slate-900">
                        HSN{" "}
                        {String(
                          activeFeature.properties.hsn ??
                            activeFeature.properties.id,
                        )}
                        {canViewMembers
                          ? ` • ${String(
                              activeFeature.properties.headName ??
                                "Household Head",
                            )}`
                          : ""}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {String(activeFeature.properties.sitioPurok ?? "")} •{" "}
                        {String(activeFeature.properties.houseNumber ?? "")}{" "}
                        (HUSN {String(activeFeature.properties.husn ?? "")})
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-semibold text-amber-700">
                      [PII REDACTED FOR STAFF ROLE — RA 10173]
                    </p>
                  )}

                  <div className="mt-1.5 grid grid-cols-2 gap-1 rounded bg-slate-100 p-1.5 text-[10px] text-slate-700">
                    <div>
                      HH Size:{" "}
                      <strong>
                        {String(activeFeature.properties.hhSize ?? 4)} members
                      </strong>
                    </div>
                    <div>
                      4Ps:{" "}
                      <strong>
                        {Number(activeFeature.properties.fourPsBeneficiary) ===
                        1
                          ? "Beneficiary"
                          : "No"}
                      </strong>
                    </div>
                    <div>
                      Power / Net:{" "}
                      <strong>
                        {Number(activeFeature.properties.electricity) === 1
                          ? "Elec"
                          : "No Elec"}{" "}
                        •{" "}
                        {Number(activeFeature.properties.internetAtHome) === 1
                          ? "Fiber/Net"
                          : "No Net"}
                      </strong>
                    </div>
                    <div>
                      Water:{" "}
                      <strong className="truncate">
                        {String(
                          activeFeature.properties.drinkingWaterSource ??
                            "Level III",
                        )}
                      </strong>
                    </div>
                  </div>

                  {canViewMembers && activeHouseholdMembers.length > 0 ? (
                    <div className="mt-2 border-t border-slate-200 pt-1.5">
                      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-600">
                        <Users className="h-3 w-3" /> Household Members
                        (Sections A–E):
                      </div>
                      <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
                        {activeHouseholdMembers.map((m) => (
                          <div
                            key={m.lineNumber}
                            className="flex items-center justify-between rounded bg-slate-50 px-1.5 py-1 text-[10px]"
                          >
                            <div>
                              <span className="font-semibold text-slate-900">
                                #{m.lineNumber} {m.firstName} {m.lastName}
                              </span>{" "}
                              <span className="text-slate-500">
                                ({m.relationToHead}, {m.sex[0]}, {m.age}y)
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {m.isSeniorCitizen && (
                                <span className="rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800">
                                  Senior
                                </span>
                              )}
                              {m.isPwd && (
                                <span className="rounded bg-purple-100 px-1 text-[9px] font-semibold text-purple-800">
                                  PWD
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    !canViewMembers && (
                      <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-medium text-amber-800">
                        Household Member Roster (Sections A–E) is restricted for
                        STAFF accounts under RA 10173.
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </Popup>
        )}
      </MapLibreMap>

      {/* =====================================================================
          TOP-LEFT: Sidebar Collapse/Expand Toggle + Live Hover Readout Pill
         ===================================================================== */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          title={
            isSidebarCollapsed
              ? "Expand Layer & CBMS Dock"
              : "Collapse Dock (Full Map Mode)"
          }
          className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-2 text-xs font-medium text-slate-100 shadow-lg backdrop-blur transition hover:border-sky-500/60 hover:bg-slate-800"
        >
          {isSidebarCollapsed ? (
            <>
              <PanelLeftOpen className="h-4 w-4 text-sky-400" />
              <span>Layers & CBMS</span>
            </>
          ) : (
            <PanelLeftClose className="h-4 w-4 text-slate-300" />
          )}
        </button>

        {hoveredReadout && (
          <div className=" flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 text-xs text-slate-100 shadow-lg backdrop-blur">
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
              {hoveredReadout.layerLabel}
            </span>
            <span className="font-semibold text-white">
              {hoveredReadout.title}
            </span>
            <span className="text-[11px] text-slate-400">
              • {hoveredReadout.subtitle}
            </span>
          </div>
        )}
      </div>

      {/* =====================================================================
          10. TOP-CENTER: Spatial Location Search Omnibox & Municipal KPI Ribbon
         ===================================================================== */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex w-full max-w-lg -translate-x-1/2 flex-col items-center px-4">
        <div className="pointer-events-auto relative w-full">
          <div className="flex items-center rounded-xl border border-slate-700/90 bg-slate-900/90 px-3 py-2 shadow-2xl backdrop-blur-md focus-within:border-sky-400">
            <Search className="mr-2 h-4 w-4 shrink-0 text-sky-400" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchFocused(true);
              }}
              placeholder="Search 12 barangays, 124 facilities, 239 roads, households, or [lat, lng]..."
              className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Search Autocomplete Dropdown */}
          {isSearchFocused && searchQuery.trim().length > 0 && (
            <div className="mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-md">
              {searchResults.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-slate-400">
                  No matching features or valid Philippine coordinates found in
                  San Jose.
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSearchResult(item)}
                    className="flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-slate-800/90"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.subtitle}
                      </div>
                    </div>
                    <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                      {item.category}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Municipal Headline KPI Pill Bar */}
        <div className="pointer-events-auto mt-1.5 flex flex-wrap items-center justify-center gap-3 rounded-full border border-slate-800/90 bg-slate-900/85 px-3.5 py-1 text-[11px] text-slate-300 shadow-lg backdrop-blur">
          <span>
            Households:{" "}
            <strong className="text-white">
              {municipalStats.totalHouseholds.toLocaleString()}
            </strong>
          </span>
          <span className="text-slate-600">•</span>
          <span>
            Population:{" "}
            <strong className="text-white">
              {municipalStats.totalPopulation.toLocaleString()}
            </strong>
          </span>
          <span className="text-slate-600">•</span>
          <span>
            Mean {selectedMetricMeta.label.split("(")[0]}:{" "}
            <strong
              className={
                isCoverageMetric ? "text-emerald-400" : "text-amber-400"
              }
            >
              {municipalStats.avgRate}%
            </strong>
          </span>
        </div>
      </div>

      {/* =====================================================================
          1, 2, 3, 4, 8. TOP-RIGHT: Floating GIS Navigation, Basemap & Measure Rail
         ===================================================================== */}
      <div className="pointer-events-auto absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
        {/* Cluster 1: Zoom, Compass, Fit San Jose Extent, 3D Pitch & Fullscreen */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/90 shadow-xl backdrop-blur">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (+)"
            className="p-2 text-slate-200 transition hover:bg-slate-800 hover:text-sky-400"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (-)"
            className="border-t border-slate-800 p-2 text-slate-200 transition hover:bg-slate-800 hover:text-sky-400"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleResetNorthPitch}
            title={`Reset North & Tilt (Bearing: ${Math.round(viewState.bearing)}°)`}
            className="border-t border-slate-800 p-2 text-slate-200 transition hover:bg-slate-800 hover:text-sky-400"
          >
            <Compass
              className="h-4 w-4 transition-transform"
              style={{ transform: `rotate(${-viewState.bearing}deg)` }}
            />
          </button>
          <button
            type="button"
            onClick={handleFitSanJoseExtent}
            title="Reset Extent to San Jose, Dinagat Islands"
            className="border-t border-slate-800 p-2 text-slate-200 transition hover:bg-slate-800 hover:text-emerald-400"
          >
            <Home className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleToggle3DPitch}
            title="Toggle 2D / 3D Perspective Tilt (50°)"
            className={`border-t border-slate-800 p-2 text-[10px] font-bold transition ${
              viewState.pitch > 15
                ? "bg-sky-500/20 text-sky-300"
                : "text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Box className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Full Screen Map View"}
            className="border-t border-slate-800 p-2 text-slate-200 transition hover:bg-slate-800 hover:text-sky-400"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Cluster 2: Visual Basemap Switcher */}
        <div className="relative z-30">
          <button
            type="button"
            onClick={() => setIsBasemapMenuOpen((v) => !v)}
            title="Switch Map Basemap Style"
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium shadow-xl backdrop-blur transition ${
              isBasemapMenuOpen
                ? "border-sky-500 bg-slate-800 text-sky-300"
                : "border-slate-700/80 bg-slate-900/90 text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Layers className="h-4 w-4 text-sky-400" />
            <span className="hidden sm:inline">{activeBasemap.name}</span>
          </button>

          {isBasemapMenuOpen && (
            <div className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border border-slate-700 bg-slate-900/95 p-2.5 shadow-2xl backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <span>Cartographic Basemap</span>
                <button
                  type="button"
                  onClick={() => setIsBasemapMenuOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {BASEMAP_OPTIONS.map((b) => {
                  const active = b.id === basemapId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setBasemapId(b.id);
                        setIsBasemapMenuOpen(false);
                      }}
                      className={`group flex flex-col overflow-hidden rounded-lg border text-left transition ${
                        active
                          ? "border-sky-400 ring-1 ring-sky-400"
                          : "border-slate-700/80 hover:border-slate-500"
                      }`}
                    >
                      <div
                        className={`relative h-11 w-full bg-gradient-to-br ${b.swatchBg} flex items-center justify-center`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shadow"
                          style={{ backgroundColor: b.swatchAccent }}
                        />
                        {active && (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-sky-500 p-0.5 text-slate-950">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-950/90 p-1.5">
                        <div className="text-[11px] font-semibold text-slate-100">
                          {b.name}
                        </div>
                        <div className="truncate text-[9px] text-slate-400">
                          {b.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cluster 3: Geodesic Distance & Area Measurement Tools */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/90 shadow-xl backdrop-blur">
            <button
              type="button"
              onClick={() => handleSelectMeasureMode("distance")}
              title="Measure Geodesic Distance (m / km)"
              className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition ${
                measureMode === "distance"
                  ? "bg-sky-500 text-slate-950 font-semibold"
                  : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Ruler className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Distance</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMeasureMode("area")}
              title="Measure Geodesic Polygon Area (ha / m²)"
              className={`flex items-center gap-1 border-l border-slate-800 px-2.5 py-2 text-xs font-medium transition ${
                measureMode === "area"
                  ? "bg-sky-500 text-slate-950 font-semibold"
                  : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Expand className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Area</span>
            </button>
          </div>

          {measureMode !== "none" && measurementSummary && (
            <div className="w-60 rounded-xl border border-sky-500/40 bg-slate-900/95 p-2.5 text-xs text-slate-100 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                  {measureMode === "distance"
                    ? "Geodesic Distance"
                    : "Geodesic Area"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMeasurePoints((pts) => pts.slice(0, -1))}
                    disabled={measurePoints.length === 0}
                    title="Undo Last Vertex"
                    className="rounded p-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeasurePoints([])}
                    disabled={measurePoints.length === 0}
                    title="Clear Measurement"
                    className="rounded p-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectMeasureMode("none")}
                    title="Close Measure Tool"
                    className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-1 text-base font-bold text-white">
                {measurementSummary.primary}
              </div>
              <div className="text-[10px] text-slate-400">
                {measurementSummary.secondary}
              </div>
              <div className="mt-1 text-[10px] text-sky-300/90">
                Click map to add vertices (WGS84 spheroidal calculation).
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          7. BOTTOM-LEFT: Collapsible Dynamic Multi-Layer Map Legend
         ===================================================================== */}
      <div className="pointer-events-auto absolute bottom-4 left-3 z-20 w-72 rounded-xl border border-slate-700/80 bg-slate-900/92 text-xs text-slate-200 shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onClick={toggleLegendCollapsed}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left font-semibold uppercase tracking-wider text-slate-300 hover:text-white"
        >
          <span>Cartographic Legend (San Jose)</span>
          {isLegendCollapsed ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {!isLegendCollapsed && (
          <div className="max-h-[52vh] space-y-3 overflow-y-auto border-t border-slate-800 px-3.5 py-2.5">
            {/* 1. Choropleth Ramp */}
            {showChoropleth && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-200">
                  <span className="truncate">{selectedMetricMeta.label}</span>
                </div>
                <div
                  className="h-2.5 w-full rounded-full border border-slate-700"
                  style={{
                    background: isCoverageMetric
                      ? activeBasemap.isLight
                        ? "linear-gradient(to right, #e2e8f0, #0891b2, #14b8a6, #10b981, #047857)"
                        : "linear-gradient(to right, #1e293b, #0891b2, #14b8a6, #10b981, #047857)"
                      : activeBasemap.isLight
                        ? "linear-gradient(to right, #e2e8f0, #fde047, #f59e0b, #ea580c, #b91c1c)"
                        : "linear-gradient(to right, #1e293b, #fde047, #f59e0b, #ea580c, #b91c1c)",
                  }}
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>Min: {municipalStats.minRate}%</span>
                  <span>Mean: {municipalStats.avgRate}%</span>
                  <span>Max: {municipalStats.maxRate}%</span>
                </div>
              </div>
            )}

            {/* 2. Household GPS Points */}
            {showHouseholdPoints && canViewPoints && (
              <div className="border-t border-slate-800/90 pt-2">
                <div className="mb-1 text-[11px] font-medium text-slate-300">
                  Household GPS Points ({surveyYear})
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-1 ring-slate-950" />
                    Poor Household
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 ring-1 ring-slate-950" />
                    Non-Poor HH
                  </span>
                </div>
              </div>
            )}

            {/* 3. Road Network */}
            {showRoads && (
              <div className="border-t border-slate-800/90 pt-2">
                <div className="mb-1 text-[11px] font-medium text-slate-300">
                  Roads (
                  {roadColorMode === "class"
                    ? "By Hierarchy"
                    : "By Surface Condition"}
                  )
                </div>
                {roadColorMode === "class" ? (
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-3.5 rounded bg-yellow-400" />{" "}
                      National
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-3.5 rounded bg-orange-400" />{" "}
                      Provincial
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-3.5 rounded bg-sky-400" />{" "}
                      Municipal
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-3.5 rounded bg-slate-300" />{" "}
                      Barangay
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-3.5 rounded bg-green-500" /> Good
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-3.5 rounded bg-yellow-500" /> Fair
                      / Passable
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-3.5 rounded bg-orange-500" /> Poor
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-3.5 rounded bg-red-500" /> Bad
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 4. Municipal Landmarks */}
            {showLandmarks && (
              <div className="border-t border-slate-800/90 pt-2">
                <div className="mb-1 text-[11px] font-medium text-slate-300">
                  Critical Facilities & Landmarks (124)
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  {LANDMARK_SECTORS.map((sec) => (
                    <span
                      key={sec.id}
                      className="flex items-center gap-1.5 truncate"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: sec.color }}
                      />
                      <span className="truncate">
                        {sec.label.split(" ")[0]}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Existing Land Use (ELU) */}
            {showLandUse && (
              <div className="border-t border-slate-800/90 pt-2">
                <div className="mb-1 text-[11px] font-medium text-slate-300">
                  DHSUD / CLUP Land Use (26 Zones)
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-yellow-400" />{" "}
                    Residential
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />{" "}
                    Commercial
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-lime-500" />{" "}
                    Agricultural
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-green-700" />{" "}
                    Forestland
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500" />{" "}
                    Water / Mangrove
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />{" "}
                    Institutional
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          9, 11. BOTTOM-RIGHT: Live Coordinate Readout (DD/DMS) & Zoom Telemetry
         ===================================================================== */}
      <div className="pointer-events-auto absolute bottom-10 right-3 z-20 flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1 text-[11px] text-slate-200 shadow-xl backdrop-blur">
        <MapPin className="h-3.5 w-3.5 text-sky-400" />
        <button
          type="button"
          onClick={toggleCoordFormat}
          title="Click to toggle between Decimal Degrees (DD) and Degrees-Minutes-Seconds (DMS)"
          className="font-mono text-[11px] text-slate-100 hover:text-sky-300"
        >
          {activeCoordReadout.latText}, {activeCoordReadout.lngText}
        </button>
        <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] font-semibold uppercase text-sky-400">
          {coordFormat}
        </span>
        <button
          type="button"
          onClick={handleCopyCoordinates}
          title="Copy Coordinate Pair (EPSG:4326)"
          className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          {copiedCoords ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
        <span className="text-slate-600">|</span>
        <span className="font-mono text-[10px] text-slate-300">
          Z {viewState.zoom.toFixed(1)}
          {viewState.pitch > 0 ? ` • ${Math.round(viewState.pitch)}°` : ""}
        </span>
      </div>
    </div>
  );
};
