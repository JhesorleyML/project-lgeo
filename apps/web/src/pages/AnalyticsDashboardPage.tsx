import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  FileSpreadsheet,
  Globe2,
  Home,
  MapPin,
  ShieldCheck,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import {
  HEADLINE_CHOROPLETH_METRICS,
  type HeadlineChoroplethMetricId,
} from "@cbms/shared";
import { useMapFilterStore } from "../store/useMapFilterStore";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const AnalyticsDashboardPage: React.FC = () => {
  const {
    themeMode,
    surveyYear,
    selectedMetric,
    dataRefreshVersion,
    setActivePage,
    setSelectedMetric,
  } = useMapFilterStore();

  const choroplethQuery = useQuery({
    queryKey: ["gis-choropleth", surveyYear, dataRefreshVersion],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/gis/choropleth?surveyYear=${surveyYear}`,
      );
      if (!res.ok) throw new Error("Failed to load barangay indicators");
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const { rows, totals, hasUploadedData } = useMemo(() => {
    const rawFeatures = choroplethQuery.data?.features ?? [];
    const items = rawFeatures.map(
      (f: { properties?: Record<string, unknown> }) => {
        const p = f.properties ?? {};
        const code = String(p.barangayGeoCode ?? "");
        return {
          barangayGeoCode: code,
          barangayName: String(p.barangayName ?? ""),
          totalHouseholds: Number(p.totalHouseholds ?? 0),
          totalPopulation: Number(p.totalPopulation ?? 0),
          poorHouseholds: Number(p.poorHouseholds ?? 0),
          poorRate: Number(p.poor_rate ?? 0),
          nearPoor5Rate: Number(p.near_poor_5_rate ?? 0),
          electricityRate: Number(p.electricity_rate ?? 0),
          internetRate: Number(p.internet_rate ?? 0),
          fourPsRate: Number(p.beneficiary_4ps_rate ?? 0),
        };
      },
    );

    const totalHouseholds = items.reduce(
      (s: number, r: { totalHouseholds: number }) => s + r.totalHouseholds,
      0,
    );
    const totalPopulation = items.reduce(
      (s: number, r: { totalPopulation: number }) => s + r.totalPopulation,
      0,
    );
    const poorHouseholds = items.reduce(
      (s: number, r: { poorHouseholds: number }) => s + r.poorHouseholds,
      0,
    );
    const avgPoorRate =
      items.length > 0
        ? items.reduce(
            (s: number, r: { poorRate: number }) => s + r.poorRate,
            0,
          ) / items.length
        : 0;
    const avgElecRate =
      items.length > 0
        ? items.reduce(
            (s: number, r: { electricityRate: number }) =>
              s + r.electricityRate,
            0,
          ) / items.length
        : 0;
    const avgNetRate =
      items.length > 0
        ? items.reduce(
            (s: number, r: { internetRate: number }) => s + r.internetRate,
            0,
          ) / items.length
        : 0;

    return {
      rows: items.sort(
        (a: { poorRate: number }, b: { poorRate: number }) =>
          b.poorRate - a.poorRate,
      ),
      hasUploadedData: totalHouseholds > 0,
      totals: {
        totalHouseholds,
        totalPopulation,
        poorHouseholds,
        avgPoorRate: avgPoorRate.toFixed(1),
        avgElecRate: avgElecRate.toFixed(1),
        avgNetRate: avgNetRate.toFixed(1),
      },
    };
  }, [choroplethQuery.data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero Banner with Full-Screen GIS Map CTA & ETL Upload CTA */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-6 ${
          themeMode === "light"
            ? "border-slate-200 bg-gradient-to-br from-white via-sky-50/70 to-indigo-50/80 shadow-sm"
            : "border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/60"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
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
          </div>
          <h1 className="mt-2 text-xl font-bold text-white">
            San Jose Municipal CBMS Data Overview
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">
            Synthesizes household-level poverty, basic utilities, social
            protection coverage, and spatial infrastructure across all 12
            barangays of San Jose, Dinagat Islands.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setActivePage("reports")}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>Generate Excel / CSV Report</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePage("uploads")}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-sky-500/50 hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-4 w-4 text-sky-400" />
            <span>Upload CBMS Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePage("map")}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-900/40 transition hover:bg-sky-500"
          >
            <Globe2 className="h-4 w-4" />
            <span>Launch Full-Screen Web-GIS Map</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Headline KPI Cards */}
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
            Pop: {totals.totalPopulation.toLocaleString()} across 12 Barangays
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Poverty Incidence</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400">
            {totals.avgPoorRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {totals.poorHouseholds.toLocaleString()} Poor Households identified
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Electricity Coverage</span>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            {totals.avgElecRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Section O (Col 280: o11_electricity)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Home Internet Access</span>
            <Wifi className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-sky-400">
            {totals.avgNetRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Section K (Col 201: k02_internet_at_home)
          </div>
        </div>
      </div>

      {/* Barangay Socio-Economic Leaderboard Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              Barangay Socio-Economic & Vulnerability Matrix (12 Barangays)
            </h2>
            <p className="text-xs text-slate-400">
              Click any metric or launch the Web-GIS Map to inspect spatial
              choropleths and household points.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Map Choropleth Metric:</span>
            <select
              value={selectedMetric}
              onChange={(e) =>
                setSelectedMetric(e.target.value as HeadlineChoroplethMetricId)
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
            >
              {HEADLINE_CHOROPLETH_METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
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
              {rows.map(
                (r: {
                  barangayGeoCode: string;
                  barangayName: string;
                  totalHouseholds: number;
                  totalPopulation: number;
                  poorHouseholds: number;
                  poorRate: number;
                  nearPoor5Rate: number;
                  electricityRate: number;
                  internetRate: number;
                  fourPsRate: number;
                }) => (
                  <tr key={r.barangayGeoCode} className="hover:bg-slate-800/40">
                    <td className="py-2.5">
                      <span className="font-semibold text-white">
                        Brgy. {r.barangayName}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-slate-500">
                        {r.barangayGeoCode}
                      </span>
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
                      {r.poorRate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono text-amber-300">
                      {r.nearPoor5Rate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono text-emerald-400">
                      {r.electricityRate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono text-sky-400">
                      {r.internetRate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono text-indigo-300">
                      {r.fourPsRate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right">
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
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Physical Infrastructure Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
          <div className="flex items-center justify-between font-bold text-emerald-400">
            <span>26 Existing Land Use Zones</span>
            <ShieldCheck className="h-4 w-4" />
          </div>
          <p className="mt-1 text-slate-400">
            DHSUD / CLUP MultiPolygon boundaries (~2,677.67 ha) covering
            Residential, Commercial, Forestland, Mangrove & Fish Sanctuary.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
          <div className="flex items-center justify-between font-bold text-sky-400">
            <span>239 Municipal Road Segments</span>
            <Globe2 className="h-4 w-4" />
          </div>
          <p className="mt-1 text-slate-400">
            61.96 km total spheroidal road network classified by hierarchy
            (National, Provincial, Municipal, Barangay) and surface condition.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
          <div className="flex items-center justify-between font-bold text-orange-400">
            <span>124 Critical Facilities & POIs</span>
            <Users className="h-4 w-4" />
          </div>
          <p className="mt-1 text-slate-400">
            Health Stations, Evacuation Centers, Schools, Barangay Halls &
            Seaports with interactive PostGIS `ST_DWithin` catchment buffers.
          </p>
        </div>
      </div>
    </div>
  );
};
