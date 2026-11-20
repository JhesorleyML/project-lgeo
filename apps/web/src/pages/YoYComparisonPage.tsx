import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileSpreadsheet, GitCompareArrows, Globe2 } from 'lucide-react';
import { useMapFilterStore } from '../store/useMapFilterStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

interface ChoroplethFeature {
  properties?: {
    barangayGeoCode?: string;
    barangayName?: string;
    totalHouseholds?: number;
    poor_rate?: number;
    internet_rate?: number;
  };
}

export const YoYComparisonPage: React.FC = () => {
  const { dataRefreshVersion, setActivePage } = useMapFilterStore();

  const query2022 = useQuery<{ features?: ChoroplethFeature[] }>({
    queryKey: ['gis-choropleth', 2022, dataRefreshVersion],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/gis/choropleth?surveyYear=2022`, { signal });
      if (!res.ok) throw new Error('Failed to load 2022 barangay indicators');
      return res.json();
    },
    staleTime: 60_000,
  });

  const query2024 = useQuery<{ features?: ChoroplethFeature[] }>({
    queryKey: ['gis-choropleth', 2024, dataRefreshVersion],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/gis/choropleth?surveyYear=2024`, { signal });
      if (!res.ok) throw new Error('Failed to load 2024 barangay indicators');
      return res.json();
    },
    staleTime: 60_000,
  });

  const { rows, totalHh2022, totalHh2024 } = useMemo(() => {
    const features2022 = query2022.data?.features ?? [];
    const features2024 = query2024.data?.features ?? [];

    const map2022 = new Map<string, NonNullable<ChoroplethFeature['properties']>>();
    for (const f of features2022) {
      if (f.properties?.barangayGeoCode) {
        map2022.set(String(f.properties.barangayGeoCode), f.properties);
      }
    }

    const map2024 = new Map<string, NonNullable<ChoroplethFeature['properties']>>();
    for (const f of features2024) {
      if (f.properties?.barangayGeoCode) {
        map2024.set(String(f.properties.barangayGeoCode), f.properties);
      }
    }

    const allCodes = Array.from(
      new Set([...map2024.keys(), ...map2022.keys()]),
    ).sort();

    let hh2022Sum = 0;
    let hh2024Sum = 0;

    const mergedRows = allCodes.map((code) => {
      const y2022 = map2022.get(code);
      const y2024 = map2024.get(code);
      const name = String(y2024?.barangayName ?? y2022?.barangayName ?? code);
      const hh2022 = Number(y2022?.totalHouseholds ?? 0);
      const hh2024 = Number(y2024?.totalHouseholds ?? 0);
      hh2022Sum += hh2022;
      hh2024Sum += hh2024;

      const poor2022 = Number(y2022?.poor_rate ?? 0);
      const poor2024 = Number(y2024?.poor_rate ?? 0);
      const net2022 = Number(y2022?.internet_rate ?? 0);
      const net2024 = Number(y2024?.internet_rate ?? 0);
      const poorDelta = Number((poor2024 - poor2022).toFixed(1));
      const netDelta = Number((net2024 - net2022).toFixed(1));

      return {
        code,
        name,
        hh2022,
        hh2024,
        poor2022,
        poor2024,
        poorDelta,
        net2022,
        net2024,
        netDelta,
      };
    });

    return {
      rows: mergedRows,
      totalHh2022: hh2022Sum,
      totalHh2024: hh2024Sum,
    };
  }, [query2022.data, query2024.data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActivePage('uploads')}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-sky-500/50 hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>Upload 2022 / 2024 CBMS Data</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePage('map')}
            className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500"
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
            <strong>Database Survey Year Notice:</strong>{' '}
            {totalHh2022 === 0 && totalHh2024 === 0
              ? 'Neither 2022 nor 2024 currently has uploaded CBMS households in PostgreSQL (0 HH).'
              : totalHh2022 === 0
                ? `2022 CBMS currently has 0 uploaded households in PostgreSQL (2024 has ${totalHh2024.toLocaleString()} HH). Upload a 2022 CBMS file in CBMS Data & ETL Upload to populate 2022 comparison metrics.`
                : `2024 POPCEN-CBMS currently has 0 uploaded households in PostgreSQL (2022 has ${totalHh2022.toLocaleString()} HH).`}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="pb-2.5">Barangay</th>
                <th className="pb-2.5 text-right">2022 HH</th>
                <th className="pb-2.5 text-right">2024 HH</th>
                <th className="pb-2.5 text-right">2022 Poverty %</th>
                <th className="pb-2.5 text-right">2024 Poverty %</th>
                <th className="pb-2.5 text-right">Poverty Change</th>
                <th className="pb-2.5 text-right">2022 Internet %</th>
                <th className="pb-2.5 text-right">2024 Internet %</th>
                <th className="pb-2.5 text-right">Internet Gain</th>
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
                    {r.poor2022.toFixed(1)}%
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-white">
                    {r.poor2024.toFixed(1)}%
                  </td>
                  <td
                    className={`py-2.5 text-right font-mono font-bold ${
                      r.poorDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {r.poorDelta > 0 ? `+${r.poorDelta}%` : `${r.poorDelta}%`}
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-300">
                    {r.net2022.toFixed(1)}%
                  </td>
                  <td className="py-2.5 text-right font-mono text-sky-300">
                    {r.net2024.toFixed(1)}%
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                    {r.netDelta >= 0 ? `+${r.netDelta}%` : `${r.netDelta}%`}
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
