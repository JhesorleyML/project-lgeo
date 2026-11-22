import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  FileSpreadsheet,
  GitCompareArrows,
  Globe2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HEADLINE_CHOROPLETH_METRICS,
  type HeadlineChoroplethMetricId,
} from "@cbms/shared";
import { useMapFilterStore } from "../store/useMapFilterStore";
import {
  buildYoYComparisonRows,
  isCoverageMetric,
} from "../utils/dashboardAnalytics";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

interface ChoroplethFeature {
  properties?: Record<string, unknown>;
}

export const YoYComparisonPage: React.FC = () => {
  const { themeMode, dataRefreshVersion, setActivePage } = useMapFilterStore();
  const [yoyMetric, setYoyMetric] =
    useState<HeadlineChoroplethMetricId>("poor_rate");

  const query2022 = useQuery<{ features?: ChoroplethFeature[] }>({
    queryKey: ["gis-choropleth", 2022, dataRefreshVersion],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/gis/choropleth?surveyYear=2022`, {
        signal,
      });
      if (!res.ok) throw new Error("Failed to load 2022 barangay indicators");
      return res.json();
    },
    staleTime: 60_000,
  });

  const query2024 = useQuery<{ features?: ChoroplethFeature[] }>({
    queryKey: ["gis-choropleth", 2024, dataRefreshVersion],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/gis/choropleth?surveyYear=2024`, {
        signal,
      });
      if (!res.ok) throw new Error("Failed to load 2024 barangay indicators");
      return res.json();
    },
    staleTime: 60_000,
  });

  const { rows, totalHh2022, totalHh2024, avgVal2022, avgVal2024, avgDelta } =
    useMemo(
      () =>
        buildYoYComparisonRows(
          query2022.data?.features ?? [],
          query2024.data?.features ?? [],
          yoyMetric,
        ),
      [query2022.data, query2024.data, yoyMetric],
    );

  const metricLabel =
    HEADLINE_CHOROPLETH_METRICS.find((m) => m.id === yoyMetric)?.label ??
    yoyMetric;
  const isCoverage = isCoverageMetric(yoyMetric);

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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header & Longitudinal Metric Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
            <GitCompareArrows className="h-4 w-4" />
            <span>Multi-Year Longitudinal Analytics (2022 vs. 2024)</span>
          </div>
          <h1 className="mt-1 text-lg font-bold text-white">
            Year-over-Year (YoY) Barangay Socio-Economic Comparison
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Live PostGIS comparison of poverty reduction and digital/utility
            infrastructure gains across CBMS survey cycles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Compare Indicator:</span>
            <select
              aria-label="Select YoY Comparison Metric"
              value={yoyMetric}
              onChange={(e) =>
                setYoyMetric(e.target.value as HeadlineChoroplethMetricId)
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100"
            >
              {HEADLINE_CHOROPLETH_METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setActivePage("uploads")}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-sky-500/50 hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>Upload 2022 / 2024 Data</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePage("map")}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-500"
          >
            <Globe2 className="h-4 w-4" />
            <span>Open Web-GIS Map</span>
          </button>
        </div>
      </div>

      {(totalHh2022 === 0 || totalHh2024 === 0) && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <strong>Database Survey Year Notice:</strong>{" "}
            {totalHh2022 === 0 && totalHh2024 === 0
              ? "Neither 2022 nor 2024 currently has uploaded CBMS households in PostgreSQL (0 HH)."
              : totalHh2022 === 0
                ? `2022 CBMS currently has 0 uploaded households in PostgreSQL (2024 has ${totalHh2024.toLocaleString()} HH). Upload a 2022 CBMS file in CBMS Data & ETL Upload to populate 2022 comparison metrics.`
                : `2024 POPCEN-CBMS currently has 0 uploaded households in PostgreSQL (2022 has ${totalHh2022.toLocaleString()} HH).`}
          </div>
        </div>
      )}

      {/* Longitudinal Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-xs text-slate-400">
            2022 Baseline ({metricLabel})
          </div>
          <div className="mt-1.5 text-2xl font-bold text-slate-200">
            {avgVal2022}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {totalHh2022.toLocaleString()} Enumerated Households (2022)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-xs text-slate-400">
            2024 Current ({metricLabel})
          </div>
          <div className="mt-1.5 text-2xl font-bold text-white">
            {avgVal2024}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {totalHh2024.toLocaleString()} Enumerated Households (2024)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Net Percentage-Point Change (2022 → 2024)</span>
            {avgDelta <= 0 ? (
              <TrendingDown className="h-4 w-4 text-emerald-400" />
            ) : (
              <TrendingUp className="h-4 w-4 text-sky-400" />
            )}
          </div>
          <div
            className={`mt-1.5 text-2xl font-bold ${
              (isCoverage ? avgDelta >= 0 : avgDelta <= 0)
                ? "text-emerald-400"
                : "text-rose-400"
            }`}
          >
            {avgDelta > 0 ? `+${avgDelta}%` : `${avgDelta}%`}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {isCoverage
              ? "Positive Δ indicates expanded service coverage"
              : "Negative Δ indicates reduced household deprivation"}
          </div>
        </div>
      </div>

      {/* 2 Side-by-Side Longitudinal Charts (Strictly 2 Charts in View) */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left Chart: 2022 vs. 2024 Grouped Column Comparison */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-3">
            <h2 className="text-xs font-bold text-white">
              2022 vs. 2024 Barangay Comparison: {metricLabel}
            </h2>
            <p className="text-[11px] text-slate-400">
              Side-by-side longitudinal rates across all 12 Barangays of San
              Jose
            </p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                margin={{ top: 10, right: 16, left: 0, bottom: 45 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridStrokeColor}
                />
                <XAxis
                  dataKey="name"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={60}
                  tick={{ fill: axisTickColor, fontSize: 10 }}
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
                <Bar
                  dataKey="val2022"
                  name="2022 CBMS (%)"
                  fill="#64748b"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="val2024"
                  name="2024 POPCEN-CBMS (%)"
                  fill={isCoverage ? "#10b981" : "#38bdf8"}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Diverging Percentage-Point Change (Δ) Bar Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="mb-3">
            <h2 className="text-xs font-bold text-white">
              Diverging Percentage-Point Change (Δ 2022 → 2024)
            </h2>
            <p className="text-[11px] text-slate-400">
              Emerald bars = Improvement · Rose bars = Regression relative to
              2022 baseline
            </p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
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
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={96}
                  tick={{ fill: axisTickColor, fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [
                    `${value > 0 ? `+${value}` : value}% pts`,
                    `Δ ${metricLabel}`,
                  ]}
                />
                <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} />
                <Bar
                  dataKey="delta"
                  name="Percentage-Point Change (Δ)"
                  radius={[0, 4, 4, 0]}
                >
                  {rows.map((entry) => (
                    <Cell
                      key={entry.code}
                      fill={entry.isPositiveOutcome ? "#10b981" : "#f43f5e"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Longitudinal Barangay Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="pb-2.5">Barangay</th>
                <th className="pb-2.5 text-right">2022 HH</th>
                <th className="pb-2.5 text-right">2024 HH</th>
                <th className="pb-2.5 text-right">2022 Selected %</th>
                <th className="pb-2.5 text-right">2024 Selected %</th>
                <th className="pb-2.5 text-right">Selected Δ</th>
                <th className="pb-2.5 text-right">2022 Poverty %</th>
                <th className="pb-2.5 text-right">2024 Poverty %</th>
                <th className="pb-2.5 text-right">2024 Internet %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map((r) => (
                <tr key={r.code} className="hover:bg-slate-800/40">
                  <td className="py-2.5 font-semibold text-white">
                    Brgy. {r.name}
                    <span className="ml-2 font-mono text-[10px] text-slate-500">
                      {r.code}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-400">
                    {r.hh2022.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-200">
                    {r.hh2024.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-300">
                    {r.val2022.toFixed(1)}%
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-white">
                    {r.val2024.toFixed(1)}%
                  </td>
                  <td
                    className={`py-2.5 text-right font-mono font-bold ${
                      r.isPositiveOutcome ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {r.delta > 0 ? `+${r.delta}%` : `${r.delta}%`}
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-300">
                    {r.poor2022.toFixed(1)}%
                  </td>
                  <td className="py-2.5 text-right font-mono text-rose-300">
                    {r.poor2024.toFixed(1)}%
                  </td>
                  <td className="py-2.5 text-right font-mono text-sky-300">
                    {r.net2024.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
