import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Building2,
  FileSpreadsheet,
  Filter,
  Globe2,
  GraduationCap,
  HeartHandshake,
  Home,
  Layers,
  MapPin,
  Radar as RadarIcon,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HEADLINE_CHOROPLETH_METRICS,
  type HeadlineChoroplethMetricId,
  type ReportPreviewResponse,
  type VulnerabilityCriterionId,
} from "@cbms/shared";
import { useMapFilterStore } from "../store/useMapFilterStore";
import {
  aggregateGisInfrastructureData,
  build10AxisMpiRadarData,
  buildEducationChartData,
  buildFourPsGapChartData,
  buildGraduatedPovertyCurveData,
  buildLivelihoodChartData,
  buildVulnerableSectorBars,
  getMetricValueFromChoroplethRow,
  isCoverageMetric,
  parseChoroplethFeatures,
  toPct,
  type DashboardTabId,
  type DashboardUnitMode,
} from "../utils/dashboardAnalytics";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

const DASHBOARD_TABS: ReadonlyArray<{
  id: DashboardTabId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "poverty_mpi",
    label: "1. Poverty & Multidimensional MPI",
    subtitle: "Choropleth Rank, 10-Axis MPI Footprint & +5%..+25% Buffer",
    icon: RadarIcon,
  },
  {
    id: "education_livelihood",
    label: "2. Education (OSY) & Livelihood",
    subtitle: "Sections A, C, D & E: OSY, Literacy, TVET, Fisherfolk & Labor",
    icon: GraduationCap,
  },
  {
    id: "social_protection_wash",
    label: "3. 4Ps Gap, Welfare & WASH",
    subtitle: "Sections B, G, J, M, N & O: 4Ps Gap, Seniors, PWD & Utilities",
    icon: HeartHandshake,
  },
  {
    id: "gis_infrastructure",
    label: "4. Physical GIS & CLUP Infrastructure",
    subtitle: "26 CLUP Land Use Zones, 239 Roads & 124 Critical Facilities",
    icon: Layers,
  },
];

export const AnalyticsDashboardPage: React.FC = () => {
  const {
    themeMode,
    surveyYear,
    selectedMetric,
    activeRole,
    dataRefreshVersion,
    showHouseholdPoints,
    setActivePage,
    setSelectedMetric,
    toggleHouseholdPoints,
    clearVulnerabilityCriteria,
    toggleVulnerabilityCriterion,
  } = useMapFilterStore();

  // Anti-clutter Progressive Disclosure state (persistent across tab switches)
  const [activeTab, setActiveTab] = useState<DashboardTabId>("poverty_mpi");
  const [selectedBarangayCode, setSelectedBarangayCode] =
    useState<string>("ALL");
  const [unitMode, setUnitMode] = useState<DashboardUnitMode>("rate");
  const [tab1RightMode, setTab1RightMode] = useState<"radar" | "buffer">(
    "radar",
  );
  const [tab4LeftMode, setTab4LeftMode] = useState<"landuse" | "roads">(
    "landuse",
  );

  // 1. Barangay Choropleth Fast-Path Query (mv_barangay_yearly_indicators)
  const choroplethQuery = useQuery({
    queryKey: ["gis-choropleth", surveyYear, dataRefreshVersion],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `${API_BASE}/gis/choropleth?surveyYear=${surveyYear}`,
        { signal },
      );
      if (!res.ok) throw new Error("Failed to load barangay indicators");
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  // 2. 8-Dimension Aggregated Barangay Summary Query (Zero PII, RA 10173 compliant for all roles including STAFF)
  const barangaySummaryQuery = useQuery<ReportPreviewResponse>({
    queryKey: [
      "dashboard-barangay-summary",
      surveyYear,
      activeRole,
      dataRefreshVersion,
    ],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `${API_BASE}/reports/preview?reportType=BARANGAY_SUMMARY&surveyYear=${surveyYear}&barangayGeoCode=ALL`,
        {
          headers: { "x-cbms-role": activeRole },
          signal,
        },
      );
      if (!res.ok) throw new Error("Failed to load sectoral barangay summary");
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  // 3. Physical GIS Reference Layers (fetched on demand or cached for Tab 4)
  const landUseQuery = useQuery({
    queryKey: ["gis-land-use"],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/gis/land-use`, { signal });
      if (!res.ok) throw new Error("Failed to load land use zones");
      return res.json();
    },
    staleTime: 300_000,
  });

  const roadsQuery = useQuery({
    queryKey: ["gis-roads"],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/gis/roads`, { signal });
      if (!res.ok) throw new Error("Failed to load road networks");
      return res.json();
    },
    staleTime: 300_000,
  });

  const landmarksQuery = useQuery({
    queryKey: ["gis-landmarks", "ALL"],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/gis/landmarks`, { signal });
      if (!res.ok) throw new Error("Failed to load municipal landmarks");
      return res.json();
    },
    staleTime: 300_000,
  });

  const choroplethRows = useMemo(
    () => parseChoroplethFeatures(choroplethQuery.data?.features ?? []),
    [choroplethQuery.data],
  );

  const reportRows = useMemo(
    () => barangaySummaryQuery.data?.barangayRows ?? [],
    [barangaySummaryQuery.data],
  );

  // Scoped Headline KPIs (reacts to Barangay Cross-Filter)
  const {
    rows,
    totals,
    hasUploadedData,
    selectedBarangayName,
    rankedChoroplethBars,
    municipalMetricMean,
  } = useMemo(() => {
    const scopeChoropleth =
      selectedBarangayCode !== "ALL"
        ? choroplethRows.filter(
            (r) => r.barangayGeoCode === selectedBarangayCode,
          )
        : choroplethRows;
    const scopeReport =
      selectedBarangayCode !== "ALL"
        ? reportRows.filter((r) => r.barangayGeoCode === selectedBarangayCode)
        : reportRows;

    const totalHouseholds = scopeChoropleth.reduce(
      (s, r) => s + r.totalHouseholds,
      0,
    );
    const totalPopulation = scopeChoropleth.reduce(
      (s, r) => s + r.totalPopulation,
      0,
    );
    const poorHouseholds = scopeChoropleth.reduce(
      (s, r) => s + r.poorHouseholds,
      0,
    );
    const totalOsyHh = scopeReport.reduce(
      (s, r) => s + (r.householdsWithOsy ?? r.outOfSchoolYouthCount ?? 0),
      0,
    );
    const totalUnreachedPoor = scopeReport.reduce(
      (s, r) => s + (r.no4psPoorHouseholds ?? 0),
      0,
    );
    const totalFisherfolk = scopeReport.reduce(
      (s, r) => s + (r.fisherfolkCount ?? 0),
      0,
    );
    const totalFarmer = scopeReport.reduce(
      (s, r) => s + (r.farmerCount ?? 0),
      0,
    );

    const avgPoorRate = toPct(poorHouseholds, totalHouseholds);
    const avgElecRate =
      scopeChoropleth.length > 0
        ? scopeChoropleth.reduce((s, r) => s + r.electricity_rate, 0) /
          scopeChoropleth.length
        : 0;
    const avgNetRate =
      scopeChoropleth.length > 0
        ? scopeChoropleth.reduce((s, r) => s + r.internet_rate, 0) /
          scopeChoropleth.length
        : 0;

    const ranked = [...choroplethRows]
      .map((r) => ({
        ...r,
        displayValue: getMetricValueFromChoroplethRow(
          r,
          selectedMetric,
          unitMode,
        ),
      }))
      .sort((a, b) => b.displayValue - a.displayValue);

    const meanVal =
      ranked.length > 0
        ? Number(
            (
              ranked.reduce((s, r) => s + r.displayValue, 0) / ranked.length
            ).toFixed(1),
          )
        : 0;

    const activeBrgy = choroplethRows.find(
      (r) => r.barangayGeoCode === selectedBarangayCode,
    );

    return {
      rows: [...choroplethRows].sort((a, b) => b.poor_rate - a.poor_rate),
      hasUploadedData:
        choroplethRows.reduce((s, r) => s + r.totalHouseholds, 0) > 0,
      selectedBarangayName: activeBrgy
        ? `Brgy. ${activeBrgy.barangayName}`
        : "All San Jose (12 Barangays)",
      rankedChoroplethBars: ranked,
      municipalMetricMean: meanVal,
      totals: {
        totalHouseholds,
        totalPopulation,
        poorHouseholds,
        avgPoorRate: avgPoorRate.toFixed(1),
        avgElecRate: avgElecRate.toFixed(1),
        avgNetRate: avgNetRate.toFixed(1),
        totalOsyHh,
        osyRate: toPct(totalOsyHh, totalHouseholds).toFixed(1),
        totalUnreachedPoor,
        totalFisherfolk,
        totalFarmer,
      },
    };
  }, [choroplethRows, reportRows, selectedBarangayCode, selectedMetric, unitMode]);

  // Memoized datasets for the 4 Tabs
  const mpiRadarData = useMemo(
    () => build10AxisMpiRadarData(reportRows, selectedBarangayCode),
    [reportRows, selectedBarangayCode],
  );

  const povertyBufferData = useMemo(
    () => buildGraduatedPovertyCurveData(choroplethRows, selectedBarangayCode),
    [choroplethRows, selectedBarangayCode],
  );

  const educationChartData = useMemo(
    () => buildEducationChartData(reportRows, unitMode),
    [reportRows, unitMode],
  );

  const livelihoodChartData = useMemo(
    () => buildLivelihoodChartData(reportRows, unitMode),
    [reportRows, unitMode],
  );

  const fourPsGapChartData = useMemo(
    () => buildFourPsGapChartData(reportRows, unitMode),
    [reportRows, unitMode],
  );

  const vulnerableSectorBars = useMemo(
    () =>
      buildVulnerableSectorBars(reportRows, selectedBarangayCode, unitMode),
    [reportRows, selectedBarangayCode, unitMode],
  );

  const gisInfraData = useMemo(
    () =>
      aggregateGisInfrastructureData(
        landUseQuery.data?.features ?? [],
        roadsQuery.data?.features ?? [],
        landmarksQuery.data?.features ?? [],
      ),
    [landUseQuery.data, roadsQuery.data, landmarksQuery.data],
  );

  const activeMetricLabel =
    HEADLINE_CHOROPLETH_METRICS.find((m) => m.id === selectedMetric)?.label ??
    selectedMetric;
  const isCoverage = isCoverageMetric(selectedMetric);
  const unitSuffix = unitMode === "rate" ? "%" : " HH";

  const tooltipStyle = useMemo(
    () => ({
      backgroundColor: themeMode === "light" ? "#ffffff" : "#0f172a",
      borderColor: themeMode === "light" ? "#cbd5e1" : "#334155",
      borderRadius: "0.75rem",
      color: themeMode === "light" ? "#0f172a" : "#f8fafc",
      fontSize: "11px",
    }),
    [themeMode],
  );

  const axisTickColor = themeMode === "light" ? "#475569" : "#94a3b8";
  const gridStrokeColor = themeMode === "light" ? "#e2e8f0" : "#1e293b";

  // Helper to deep-link from any chart into the Full-Screen Web-GIS Map with a vulnerability filter
  const handleInspectVulnerabilityOnMap = (
    criterion: VulnerabilityCriterionId,
  ) => {
    clearVulnerabilityCriteria();
    toggleVulnerabilityCriterion(criterion);
    if (!showHouseholdPoints) {
      toggleHouseholdPoints();
    }
    setActivePage("map");
  };

  const handleToggleBarangayScope = (code: string) => {
    setSelectedBarangayCode((prev) => (prev === code ? "ALL" : code));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* 1. PERSISTENT HERO & GLOBAL CROSS-FILTER BAR (Always Visible - 3-Second Rule) */}
      <div
        className={`flex flex-col gap-4 rounded-2xl border p-5 ${
          themeMode === "light"
            ? "border-slate-200 bg-gradient-to-br from-white via-sky-50/70 to-indigo-50/80 shadow-sm"
            : "border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/60"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                {surveyYear} Survey Snapshot
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  hasUploadedData
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {hasUploadedData
                  ? "Live PostGIS CBMS Dataset"
                  : `No Uploaded Dataset for ${surveyYear} (0 Households)`}
              </span>
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                Scope: {selectedBarangayName}
              </span>
            </div>
            <h1 className="mt-1.5 text-xl font-bold text-white">
              San Jose Municipal CBMS Decision Support & Spatial Analytics
            </h1>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-400">
              Cross-filtered multi-sectoral analytics covering Poverty, 10-Axis
              MPI, Education & OSY, Employment & Livelihood, 4Ps Social
              Protection, and CLUP GIS Infrastructure.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActivePage("reports")}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Report Generator</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage("uploads")}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-sky-500/50 hover:bg-slate-800"
            >
              <FileSpreadsheet className="h-4 w-4 text-sky-400" />
              <span>Upload CBMS</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage("map")}
              className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-sky-900/40 transition hover:bg-sky-500"
            >
              <Globe2 className="h-4 w-4" />
              <span>Launch Web-GIS Map</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Global Cross-Filter Controls (Barangay Scope + MAUP Normalized Rate vs. HH Count Toggle) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-300">
              <Filter className="h-3.5 w-3.5 text-sky-400" />
              <span>Barangay Cross-Filter:</span>
            </span>
            <select
              aria-label="Barangay Cross-Filter"
              value={selectedBarangayCode}
              onChange={(e) => setSelectedBarangayCode(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-100"
            >
              <option value="ALL">All San Jose (12 Barangays)</option>
              {choroplethRows.map((b) => (
                <option key={b.barangayGeoCode} value={b.barangayGeoCode}>
                  Brgy. {b.barangayName} ({b.barangayGeoCode})
                </option>
              ))}
            </select>
            {selectedBarangayCode !== "ALL" && (
              <button
                type="button"
                onClick={() => setSelectedBarangayCode("ALL")}
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20"
              >
                Reset to All 12 Barangays ×
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Metric Unit:</span>
              <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5">
                <button
                  type="button"
                  onClick={() => setUnitMode("rate")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    unitMode === "rate"
                      ? "bg-sky-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  % Rate (Normalized)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitMode("count")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    unitMode === "count"
                      ? "bg-sky-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  # Household Count
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PERSISTENT TOP-LINE KPI ROW (4 Cards Max - Dynamically Scoped) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Enumerated Households</span>
            <Home className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {totals.totalHouseholds.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Pop: {totals.totalPopulation.toLocaleString()} ({selectedBarangayName})
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Poverty & 4Ps Gap</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400">
            {totals.avgPoorRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {totals.poorHouseholds.toLocaleString()} Poor HH (
            {totals.totalUnreachedPoor.toLocaleString()} without 4Ps)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Out-of-School Youth & Primary Livelihood</span>
            <GraduationCap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            {totals.totalOsyHh.toLocaleString()} HH{" "}
            <span className="text-sm font-normal text-slate-400">
              ({totals.osyRate}%)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Fisherfolk: {totals.totalFisherfolk.toLocaleString()} HH · Farmers:{" "}
            {totals.totalFarmer.toLocaleString()} HH
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Power & Digital Access</span>
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2 text-2xl font-bold text-emerald-400">
            <span>{totals.avgElecRate}%</span>
            <span className="text-xs font-semibold text-sky-400">
              / {totals.avgNetRate}% Net
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Electricity (Sec O) & Home Internet (Sec K)
          </div>
        </div>
      </div>

      {/* 3. TABBED ANALYTICAL CONTAINER (Hybrid Progressive Disclosure: Strictly 2 Charts Per Active Tab) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        {/* 4 Thematic Domain Tabs */}
        <div
          role="tablist"
          aria-label="CBMS Analytical Domain Tabs"
          className="mb-5 grid gap-2 border-b border-slate-800 pb-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {DASHBOARD_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  isActive
                    ? "border-sky-500/60 bg-sky-500/15 text-white shadow-sm"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? "text-sky-400" : "text-slate-400"
                    }`}
                  />
                  <span>{tab.label}</span>
                </div>
                <span className="mt-1 line-clamp-1 text-[10px] text-slate-400">
                  {tab.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: POVERTY & MULTIDIMENSIONAL MPI (2 Paired Charts) */}
        {activeTab === "poverty_mpi" && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Tab 1 Left Chart: Ranked Barangay Choropleth Indicator Bar Chart */}
            <div className="flex flex-col rounded-xl border border-slate-800/90 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold text-white">
                    Barangay Ranking: {activeMetricLabel}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Click any bar to cross-filter the dashboard · Dashed line =
                    Municipal Mean ({municipalMetricMean}
                    {unitSuffix})
                  </p>
                </div>
                <select
                  aria-label="Select Choropleth Indicator"
                  value={selectedMetric}
                  onChange={(e) =>
                    setSelectedMetric(
                      e.target.value as HeadlineChoroplethMetricId,
                    )
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-100"
                >
                  {HEADLINE_CHOROPLETH_METRICS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rankedChoroplethBars}
                    layout="vertical"
                    margin={{ top: 5, right: 24, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStrokeColor}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: axisTickColor, fontSize: 10 }}
                      unit={unitMode === "rate" ? "%" : ""}
                    />
                    <YAxis
                      type="category"
                      dataKey="barangayName"
                      width={96}
                      tick={{ fill: axisTickColor, fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [
                        `${value.toLocaleString()}${unitSuffix}`,
                        activeMetricLabel,
                      ]}
                    />
                    <ReferenceLine
                      x={municipalMetricMean}
                      stroke="#38bdf8"
                      strokeDasharray="4 4"
                      label={{
                        value: `Mean: ${municipalMetricMean}${unitMode === "rate" ? "%" : ""}`,
                        position: "top",
                        fill: "#38bdf8",
                        fontSize: 10,
                      }}
                    />
                    <Bar
                      dataKey="displayValue"
                      name={activeMetricLabel}
                      radius={[0, 4, 4, 0]}
                      cursor="pointer"
                      onClick={(d: { barangayGeoCode?: string }) => {
                        if (d?.barangayGeoCode) {
                          handleToggleBarangayScope(d.barangayGeoCode);
                        }
                      }}
                    >
                      {rankedChoroplethBars.map((entry) => {
                        const isSelected =
                          selectedBarangayCode === entry.barangayGeoCode;
                        const baseColor = isCoverage ? "#10b981" : "#f43f5e";
                        const highlightColor = isCoverage
                          ? "#34d399"
                          : "#fb7185";
                        return (
                          <Cell
                            key={entry.barangayGeoCode}
                            fill={isSelected ? highlightColor : baseColor}
                            fillOpacity={
                              selectedBarangayCode === "ALL" || isSelected
                                ? 0.92
                                : 0.35
                            }
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tab 1 Right Chart: 10-Axis Multidimensional Deprivation Radar OR Graduated Poverty Buffer Curve */}
            <div className="flex flex-col rounded-xl border border-slate-800/90 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold text-white">
                    {tab1RightMode === "radar"
                      ? `10-Axis Multidimensional Deprivation Footprint (${selectedBarangayName})`
                      : `Graduated Poverty & Shock-Vulnerability Buffer (+5% to +25%)`}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {tab1RightMode === "radar"
                      ? "Includes Poverty, OSY (Education), Unemployment, Hunger, WASH, Housing & Disasters"
                      : "Cumulative households susceptible to inflation or typhoon income shocks"}
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setTab1RightMode("radar")}
                    className={`rounded-md px-2.5 py-1 font-semibold transition ${
                      tab1RightMode === "radar"
                        ? "bg-sky-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    10-Axis MPI Radar
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab1RightMode("buffer")}
                    className={`rounded-md px-2.5 py-1 font-semibold transition ${
                      tab1RightMode === "buffer"
                        ? "bg-sky-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    +5%..+25% Buffer Curve
                  </button>
                </div>
              </div>

              <div className="h-80 w-full">
                {tab1RightMode === "radar" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      data={mpiRadarData}
                      outerRadius="72%"
                      margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
                    >
                      <PolarGrid stroke={gridStrokeColor} />
                      <PolarAngleAxis
                        dataKey="shortAxis"
                        tick={{ fill: axisTickColor, fontSize: 10 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        tick={{ fill: axisTickColor, fontSize: 9 }}
                        tickFormatter={(val: number) => `${val}%`}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => [
                          `${value}%`,
                          name,
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Radar
                        name={selectedBarangayName}
                        dataKey="scopeRate"
                        stroke="#f43f5e"
                        fill="#f43f5e"
                        fillOpacity={0.4}
                      />
                      <Radar
                        name="San Jose Municipal Average"
                        dataKey="municipalRate"
                        stroke="#38bdf8"
                        fill="#38bdf8"
                        fillOpacity={0.18}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={povertyBufferData}
                      margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridStrokeColor}
                      />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fill: axisTickColor, fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fill: axisTickColor, fontSize: 10 }}
                        unit="%"
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number, name: string) => [
                          `${value}%`,
                          name,
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        name={`${selectedBarangayName} (% HH)`}
                        stroke="#f43f5e"
                        fill="#f43f5e"
                        fillOpacity={0.35}
                      />
                      <Area
                        type="monotone"
                        dataKey="municipalRate"
                        name="Municipal Baseline (% HH)"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.15}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EDUCATION (OSY) & LIVELIHOOD (Sections A, C, D & E — 2 Paired Charts) */}
        {activeTab === "education_livelihood" && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Tab 2 Left Chart: Education, Out-of-School Youth (OSY), Basic Literacy Gap & TVET (Sections A & D) */}
            <div className="flex flex-col rounded-xl border border-slate-800/90 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold text-white">
                    Education, Out-of-School Youth (OSY), Literacy & TVET
                    (Sections A & D)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Compares OSY (Age 6–24 not attending school), Basic
                    Illiteracy (10+), and TVET Graduates/Trainees
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage("reports")}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20"
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>Export OSY Roster</span>
                </button>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={educationChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStrokeColor}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: axisTickColor, fontSize: 10 }}
                      unit={unitMode === "rate" ? "%" : ""}
                    />
                    <YAxis
                      type="category"
                      dataKey="barangayName"
                      width={96}
                      tick={{ fill: axisTickColor, fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => [
                        `${value.toLocaleString()}${unitSuffix}`,
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="osyValue"
                      name="Out-of-School Youth (OSY 6–24)"
                      fill="#f59e0b"
                      radius={[0, 3, 3, 0]}
                      cursor="pointer"
                      onClick={(d: { barangayGeoCode?: string }) =>
                        d?.barangayGeoCode &&
                        handleToggleBarangayScope(d.barangayGeoCode)
                      }
                    />
                    <Bar
                      dataKey="nonLiterateValue"
                      name="Basic Literacy Gap (Age 10+)"
                      fill="#f43f5e"
                      radius={[0, 3, 3, 0]}
                    />
                    <Bar
                      dataKey="tvetValue"
                      name="TVET / TESDA Graduates"
                      fill="#38bdf8"
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tab 2 Right Chart: Employment, Primary Livelihood (Fisherfolk vs. Farmers) & Labor Force (Sections C & E) */}
            <div className="flex flex-col rounded-xl border border-slate-800/90 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold text-white">
                    Employment, Livelihood & Labor Force (Sections C & E)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Fisherfolk (E18) vs. Farmers (E17) alongside Unemployed,
                    Underemployed & OFW Households
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage("reports")}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/20"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>Export Livelihood Roster</span>
                </button>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={livelihoodChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStrokeColor}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: axisTickColor, fontSize: 10 }}
                      unit={unitMode === "rate" ? "%" : ""}
                    />
                    <YAxis
                      type="category"
                      dataKey="barangayName"
                      width={96}
                      tick={{ fill: axisTickColor, fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => [
                        `${value.toLocaleString()}${unitSuffix}`,
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="fisherfolkValue"
                      name="Fisherfolk (Sec E18)"
                      fill="#06b6d4"
                      radius={[0, 3, 3, 0]}
                      cursor="pointer"
                      onClick={(d: { barangayGeoCode?: string }) =>
                        d?.barangayGeoCode &&
                        handleToggleBarangayScope(d.barangayGeoCode)
                      }
                    />
                    <Bar
                      dataKey="farmerValue"
                      name="Farmers (Sec E17)"
                      fill="#10b981"
                      radius={[0, 3, 3, 0]}
                    />
                    <Bar
                      dataKey="unemployedValue"
                      name="Unemployed"
                      fill="#f43f5e"
                      radius={[0, 3, 3, 0]}
                    />
                    <Bar
                      dataKey="underemployedValue"
                      name="Underemployed"
                      fill="#a855f7"
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SOCIAL PROTECTION (4Ps GAP), VULNERABLE SECTORS & WASH (2 Paired Charts) */}
        {activeTab === "social_protection_wash" && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Tab 3 Left Chart: 4Ps Coverage vs. Unreached Poor (no_4ps_poor Gap) Stacked Bar Chart */}
            <div className="flex flex-col rounded-xl border border-slate-800/90 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold text-white">
                    4Ps Social Protection Coverage vs. Unreached Poor Gap (Sec
                    M)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Stacks 4Ps-Covered Poor HH against Left-Behind Indigent
                    Households (poor = 1 AND 4Ps != 1)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInspectVulnerabilityOnMap("no_4ps_poor")}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/25"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Map Unreached Poor</span>
                </button>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fourPsGapChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStrokeColor}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: axisTickColor, fontSize: 10 }}
                      unit={unitMode === "rate" ? "%" : ""}
                    />
                    <YAxis
                      type="category"
                      dataKey="barangayName"
                      width={96}
                      tick={{ fill: axisTickColor, fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => [
                        `${value.toLocaleString()}${unitSuffix}`,
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="coveredPoorValue"
                      stackId="fourps"
                      name="4Ps-Covered Poor HH"
                      fill="#10b981"
                    />
                    <Bar
                      dataKey="unreachedPoorGapValue"
                      stackId="fourps"
                      name="Unreached Poor Gap (No 4Ps)"
                      fill="#f43f5e"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tab 3 Right Chart: Vulnerable Demographics & WASH/Housing Deprivations with 1-Click Map Filter */}
            <div className="flex flex-col rounded-xl border border-slate-800/90 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold text-white">
                    Vulnerable Groups & WASH/Housing Deprivations (
                    {selectedBarangayName})
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Click any vulnerability bar to isolate matching household
                    GPS points on the Web-GIS Map
                  </p>
                </div>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={vulnerableSectorBars}
                    layout="vertical"
                    margin={{ top: 5, right: 24, left: 16, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStrokeColor}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: axisTickColor, fontSize: 10 }}
                      unit={unitMode === "rate" ? "%" : ""}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={150}
                      tick={{ fill: axisTickColor, fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [
                        `${value.toLocaleString()}${unitSuffix}`,
                        "Affected Households",
                      ]}
                    />
                    <Bar
                      dataKey="value"
                      name="Affected Households"
                      radius={[0, 4, 4, 0]}
                      cursor="pointer"
                      onClick={(d: {
                        mapCriterion?: VulnerabilityCriterionId;
                      }) => {
                        if (d?.mapCriterion) {
                          handleInspectVulnerabilityOnMap(d.mapCriterion);
                        }
                      }}
                    >
                      {vulnerableSectorBars.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PHYSICAL GIS & CLUP INFRASTRUCTURE (2 Paired Charts) */}
        {activeTab === "gis_infrastructure" && (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Tab 4 Left Chart: CLUP Existing Land Use (ha) OR Road Network Condition (km) */}
            <div className="flex flex-col rounded-xl border border-slate-800/90 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold text-white">
                    {tab4LeftMode === "landuse"
                      ? "CLUP Existing Land Use Area Breakdown (~2,677.67 ha)"
                      : "Municipal Road Network Condition (~61.96 km Spheroidal)"}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {tab4LeftMode === "landuse"
                      ? "26 DHSUD / CLUP MultiPolygon zones stored in EPSG:4326"
                      : "239 Road MultiLineString segments measured via PostGIS ST_Length(::geography)"}
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setTab4LeftMode("landuse")}
                    className={`rounded-md px-2.5 py-1 font-semibold transition ${
                      tab4LeftMode === "landuse"
                        ? "bg-emerald-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Land Use (ha)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab4LeftMode("roads")}
                    className={`rounded-md px-2.5 py-1 font-semibold transition ${
                      tab4LeftMode === "roads"
                        ? "bg-sky-600 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Roads (km)
                  </button>
                </div>
              </div>

              <div className="h-80 w-full">
                {tab4LeftMode === "landuse" ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={gisInfraData.landUseByCategory}
                      layout="vertical"
                      margin={{ top: 5, right: 24, left: 16, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridStrokeColor}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fill: axisTickColor, fontSize: 10 }}
                        unit=" ha"
                      />
                      <YAxis
                        type="category"
                        dataKey="category"
                        width={135}
                        tick={{ fill: axisTickColor, fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [
                          `${value.toLocaleString()} ha`,
                          "CLUP Area",
                        ]}
                      />
                      <Bar
                        dataKey="hectares"
                        name="Area (Hectares)"
                        fill="#10b981"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={gisInfraData.roadsByCondition}
                      layout="vertical"
                      margin={{ top: 5, right: 24, left: 16, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridStrokeColor}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fill: axisTickColor, fontSize: 10 }}
                        unit=" km"
                      />
                      <YAxis
                        type="category"
                        dataKey="condition"
                        width={110}
                        tick={{ fill: axisTickColor, fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [
                          `${value.toLocaleString()} km`,
                          "Spheroidal Length",
                        ]}
                      />
                      <Bar
                        dataKey="lengthKm"
                        name="Length (km)"
                        fill="#38bdf8"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Tab 4 Right Chart: 124 Critical Facilities & Landmarks by Sector */}
            <div className="flex flex-col rounded-xl border border-slate-800/90 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold text-white">
                    Critical Facilities & Community Lifelines by Sector (124
                    POIs)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Supports PostGIS ST_DWithin(geom::geography) 250m–1000m
                    service catchment buffers on the Map
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePage("map")}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/20"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Open Catchment Map</span>
                </button>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={gisInfraData.facilitiesBySector}
                    layout="vertical"
                    margin={{ top: 5, right: 24, left: 16, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStrokeColor}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: axisTickColor, fontSize: 10 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={145}
                      tick={{ fill: axisTickColor, fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [
                        `${value} Facilities`,
                        "Mapped POIs",
                      ]}
                    />
                    <Bar
                      dataKey="count"
                      name="Facility Count"
                      radius={[0, 4, 4, 0]}
                    >
                      {gisInfraData.facilitiesBySector.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. INTERACTIVE 12-BARANGAY MATRIX TABLE (Click any row to cross-filter the active charts above) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              Barangay Socio-Economic & Vulnerability Matrix (12 Barangays)
            </h2>
            <p className="text-xs text-slate-400">
              Click any Barangay row to cross-filter the active charts above, or
              launch the Web-GIS Map.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <BarChart3 className="h-4 w-4 text-sky-400" />
            <span className="text-slate-400">Active Scope:</span>
            <span className="font-bold text-sky-300">
              {selectedBarangayName}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="pb-2.5">Barangay (PSGC)</th>
                <th className="pb-2.5 text-right">Households</th>
                <th className="pb-2.5 text-right">Population</th>
                <th className="pb-2.5 text-right">Poor HH</th>
                <th className="pb-2.5 text-right">Poverty Rate</th>
                <th className="pb-2.5 text-right">Near-Poor (+5%)</th>
                <th className="pb-2.5 text-right">Electricity</th>
                <th className="pb-2.5 text-right">Home Internet</th>
                <th className="pb-2.5 text-right">4Ps Coverage</th>
                <th className="pb-2.5 text-right">GIS Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map((r) => {
                const isSelected = selectedBarangayCode === r.barangayGeoCode;
                return (
                  <tr
                    key={r.barangayGeoCode}
                    onClick={() =>
                      handleToggleBarangayScope(r.barangayGeoCode)
                    }
                    className={`cursor-pointer transition ${
                      isSelected
                        ? "bg-sky-500/15 hover:bg-sky-500/20"
                        : "hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="py-2.5">
                      <span className="font-semibold text-white">
                        Brgy. {r.barangayName}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-slate-500">
                        {r.barangayGeoCode}
                      </span>
                      {isSelected && (
                        <span className="ml-2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-300">
                          Active Filter
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-200">
                      {r.totalHouseholds.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-300">
                      {r.totalPopulation.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-mono text-rose-300">
                      {r.poorHouseholds.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-rose-400">
                      {r.poor_rate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono text-amber-300">
                      {r.near_poor_5_rate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono text-emerald-400">
                      {r.electricity_rate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono text-sky-400">
                      {r.internet_rate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono text-indigo-300">
                      {r.beneficiary_4ps_rate.toFixed(1)}%
                    </td>
                    <td
                      className="py-2.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setActivePage("map")}
                        className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/20"
                      >
                        <MapPin className="h-3 w-3" />
                        <span>Map</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
