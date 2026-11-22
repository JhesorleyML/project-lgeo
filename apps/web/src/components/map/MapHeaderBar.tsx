import React from "react";
import { ArrowLeft, Bot, Globe2 } from "lucide-react";
import { useMapFilterStore } from "../../store/useMapFilterStore";
import { BASEMAP_OPTIONS, type BasemapId } from "../../utils/basemaps";
import { UserProfileMenu } from "../layout/UserProfileMenu";
import { ThemeToggleButton } from "../layout/ThemeToggleButton";

export const MapHeaderBar: React.FC = () => {
  const {
    surveyYear,
    basemapId,
    activeVulnerabilityCriteria,
    setActivePage,
    setSurveyYear,
    setBasemapId,
    toggleAiDrawer,
  } = useMapFilterStore();

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2">
      <div className="flex items-center gap-3">
        {/* Return to Dashboard Button (Emphasizes Dedicated Mapping Mode) */}
        <button
          type="button"
          onClick={() => setActivePage("dashboard")}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-sm transition hover:border-sky-500/60 hover:bg-slate-700 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-sky-400" />
          <span>Return to Dashboard</span>
        </button>

        <div className="hidden h-5 w-px bg-slate-800 sm:block" />

        <div className="flex items-center gap-2">
          <Globe2 className="hidden h-4 w-4 text-sky-400 sm:block" />
          <div>
            <h1 className="text-xs font-bold tracking-tight text-white sm:text-sm">
              Web-GIS Spatial Explorer — San Jose, Dinagat Islands
            </h1>
            <p className="hidden text-[10px] text-slate-400 md:block">
              PostGIS 3.4 • 12 Barangays • 26 CLUP Zones • 239 Roads • 124
              Landmarks
              {activeVulnerabilityCriteria.length > 0 && (
                <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.2 font-semibold text-rose-300">
                  {activeVulnerabilityCriteria.length} Vulnerability Filter
                  {activeVulnerabilityCriteria.length > 1 ? "s" : ""} Active
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden items-center gap-1.5 text-xs lg:flex">
          <span className="text-slate-400">Basemap:</span>
          <select
            value={basemapId}
            onChange={(e) => setBasemapId(e.target.value as BasemapId)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-sky-300"
          >
            {BASEMAP_OPTIONS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="hidden text-slate-400 sm:inline">Year:</span>
          <select
            value={surveyYear}
            onChange={(e) => setSurveyYear(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-100"
          >
            <option value={2024}>2024 POPCEN-CBMS</option>
            <option value={2022}>2022 CBMS</option>
          </select>
        </div>

        <button
          type="button"
          onClick={toggleAiDrawer}
          className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/25 hover:text-white"
        >
          <Bot className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI Analyst</span>
        </button>

        <ThemeToggleButton />
        <UserProfileMenu />
      </div>
    </header>
  );
};
