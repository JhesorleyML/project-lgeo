import React, { useState } from 'react';
import {
  CBMS_SECTIONS,
  HEADLINE_CHOROPLETH_METRICS,
  LANDMARK_SECTORS,
  VULNERABILITY_CRITERIA,
  canAccessHouseholdData,
  hasFullDataAccess,
  type HeadlineChoroplethMetricId,
  type LandmarkSectorId,
  type RoadColorMode,
} from '@cbms/shared';
import { ChevronDown, ChevronUp, Download, Filter, RotateCcw } from 'lucide-react';
import { useMapFilterStore } from '../../store/useMapFilterStore';

export const LayerControlSidebar: React.FC = () => {
  const {
    selectedMetric,
    activeRole,
    isSidebarCollapsed,
    showChoropleth,
    showBarangayLabels,
    showLandUse,
    showRoads,
    roadColorMode,
    showLandmarks,
    selectedLandmarkSector,
    showHouseholdPoints,
    layerOpacities,
    activeVulnerabilityCriteria,
    setActivePage,
    setSelectedMetric,
    toggleChoropleth,
    toggleBarangayLabels,
    toggleLandUse,
    toggleRoads,
    setRoadColorMode,
    toggleLandmarks,
    setSelectedLandmarkSector,
    toggleHouseholdPoints,
    setLayerOpacity,
    toggleVulnerabilityCriterion,
    clearVulnerabilityCriteria,
  } = useMapFilterStore();

  const [showSectionCatalog, setShowSectionCatalog] = useState(false);
  const fullAccess = hasFullDataAccess(activeRole);
  const canViewHouseholds = canAccessHouseholdData(activeRole);

  if (isSidebarCollapsed) return null;

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-900/95 p-4">
      {/* 1. CBMS Socio-Economic Layers */}
      <div className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          1. CBMS Socio-Economic Layers
        </h2>
        <label className="mb-1.5 block text-xs text-slate-300">
          Headline Vulnerability / KPI Metric
        </label>
        <select
          value={selectedMetric}
          onChange={(e) =>
            setSelectedMetric(e.target.value as HeadlineChoroplethMetricId)
          }
          className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-slate-100"
        >
          {HEADLINE_CHOROPLETH_METRICS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <div className="mt-3 space-y-2.5 text-xs">
          {/* Barangay Choropleth Card */}
          <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-medium text-slate-200">
                <input
                  type="checkbox"
                  checked={showChoropleth}
                  onChange={toggleChoropleth}
                  className="rounded border-slate-700"
                />
                <span>Barangay Choropleth</span>
              </label>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-indigo-300">
                12 Brgys
              </span>
            </div>

            {showChoropleth && (
              <div className="mt-2 space-y-2 pl-5">
                <label className="flex items-center gap-2 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={showBarangayLabels}
                    onChange={toggleBarangayLabels}
                    className="rounded border-slate-700"
                  />
                  <span>Show Barangay Name & Rate Labels</span>
                </label>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Fill Opacity</span>
                    <span>{Math.round(layerOpacities.choropleth * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={0.95}
                    step={0.05}
                    value={layerOpacities.choropleth}
                    onChange={(e) =>
                      setLayerOpacity('choropleth', Number(e.target.value))
                    }
                    className="h-1.5 w-full cursor-pointer accent-sky-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Household GPS Points Card */}
          <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-medium text-slate-200">
                <input
                  type="checkbox"
                  checked={showHouseholdPoints}
                  onChange={toggleHouseholdPoints}
                  disabled={!canViewHouseholds}
                  className="rounded border-slate-700"
                />
                <span
                  className={!canViewHouseholds ? 'text-slate-500 line-through' : ''}
                >
                  Household GPS Points
                </span>
              </label>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-emerald-400">
                PostGIS MVT
              </span>
            </div>
            {!fullAccess && (
              <p className="mt-1 pl-5 text-[10px] text-amber-400/90">
                Household-level data enabled; member roster details (Sections A–E) are restricted for STAFF under RA 10173.
              </p>
            )}
            {showHouseholdPoints && canViewHouseholds && (
              <div className="mt-2 pl-5">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Point Opacity</span>
                  <span>{Math.round(layerOpacities.households * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={layerOpacities.households}
                  onChange={(e) =>
                    setLayerOpacity('households', Number(e.target.value))
                  }
                  className="h-1.5 w-full cursor-pointer accent-emerald-400"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive CBMS Multi-Section Vulnerability Criteria Toggles (Sections A–O + Poverty) */}
      <div className="mb-5 border-t border-slate-800 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
            <Filter className="h-3.5 w-3.5" />
            <span>2. CBMS Vulnerability Criteria</span>
          </h2>
          {activeVulnerabilityCriteria.length > 0 && (
            <button
              type="button"
              onClick={clearVulnerabilityCriteria}
              className="flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/30"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Reset ({activeVulnerabilityCriteria.length})</span>
            </button>
          )}
        </div>
        <p className="mb-2.5 text-[11px] text-slate-400">
          Toggle CBMS survey section indicators (A–O + Poverty) to isolate
          vulnerable households on the map:
        </p>

        <div className="space-y-1.5">
          {VULNERABILITY_CRITERIA.map((crit) => {
            const isChecked = activeVulnerabilityCriteria.includes(crit.id);
            return (
              <label
                key={crit.id}
                title={crit.description}
                className={`flex cursor-pointer items-start justify-between gap-2 rounded-lg border p-2 text-xs transition ${
                  isChecked
                    ? 'border-rose-500/60 bg-rose-500/15 text-white'
                    : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleVulnerabilityCriterion(crit.id)}
                    className="mt-0.5 rounded border-slate-700 accent-rose-500"
                  />
                  <div>
                    <div className="text-[11px] font-medium leading-tight">
                      {crit.label}
                    </div>
                    <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                      {crit.columnRef}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-sky-300">
                  Sec {crit.sectionCode}
                </span>
              </label>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setActivePage('reports')}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25"
        >
          <Download className="h-3.5 w-3.5" />
          <span>
            Export Excel / CSV Report
            {activeVulnerabilityCriteria.length > 0
              ? ` (${activeVulnerabilityCriteria.length} Filter${activeVulnerabilityCriteria.length > 1 ? 's' : ''})`
              : ' (8 Dimensions)'}
          </span>
        </button>
      </div>

      {/* 3. Municipal Physical & Infrastructure Reference Layers */}
      <div className="mb-5 border-t border-slate-800 pt-4">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          3. Municipal GIS Reference Layers
        </h2>

        <div className="space-y-2.5 text-xs">
          {/* Land Use Toggle */}
          <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5">
            <label className="flex items-center justify-between font-medium text-slate-200">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showLandUse}
                  onChange={toggleLandUse}
                  className="rounded border-slate-700"
                />
                <span>Existing Land Use (ELU)</span>
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-emerald-400">
                26 Zones
              </span>
            </label>
            <p className="mt-1 pl-5 text-[11px] text-slate-400">
              DHSUD/CLUP zones (Residential, Agri, Forestland, Mangrove,
              Sanctuary).
            </p>
            {showLandUse && (
              <div className="mt-2 pl-5">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Zone Opacity</span>
                  <span>{Math.round(layerOpacities.landUse * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={0.95}
                  step={0.05}
                  value={layerOpacities.landUse}
                  onChange={(e) =>
                    setLayerOpacity('landUse', Number(e.target.value))
                  }
                  className="h-1.5 w-full cursor-pointer accent-emerald-400"
                />
              </div>
            )}
          </div>

          {/* Road Network Toggle & Styling Mode */}
          <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5">
            <label className="flex items-center justify-between font-medium text-slate-200">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showRoads}
                  onChange={toggleRoads}
                  className="rounded border-slate-700"
                />
                <span>Municipal Road Network</span>
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-400">
                239 Segments
              </span>
            </label>

            {showRoads && (
              <div className="mt-2 space-y-2 pl-5">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Road Color Styling:
                  </label>
                  <select
                    value={roadColorMode}
                    onChange={(e) =>
                      setRoadColorMode(e.target.value as RoadColorMode)
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100"
                  >
                    <option value="class">
                      By Road Hierarchy (Nat/Prov/Mun/Brgy)
                    </option>
                    <option value="condition">
                      By Surface Condition (Good/Fair/Poor/Bad)
                    </option>
                  </select>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Line Opacity</span>
                    <span>{Math.round(layerOpacities.roads * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={layerOpacities.roads}
                    onChange={(e) =>
                      setLayerOpacity('roads', Number(e.target.value))
                    }
                    className="h-1.5 w-full cursor-pointer accent-sky-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Landmarks Toggle & Sector Filter */}
          <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5">
            <label className="flex items-center justify-between font-medium text-slate-200">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showLandmarks}
                  onChange={toggleLandmarks}
                  className="rounded border-slate-700"
                />
                <span>Landmarks & Critical Facilities</span>
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-orange-400">
                124 POIs
              </span>
            </label>

            {showLandmarks && (
              <div className="mt-2 space-y-2 pl-5">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Filter Facility Sector:
                  </label>
                  <select
                    value={selectedLandmarkSector}
                    onChange={(e) =>
                      setSelectedLandmarkSector(
                        e.target.value as LandmarkSectorId,
                      )
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-100"
                  >
                    <option value="ALL">All Facility Sectors (124)</option>
                    {LANDMARK_SECTORS.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Marker Opacity</span>
                    <span>{Math.round(layerOpacities.landmarks * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={layerOpacities.landmarks}
                    onChange={(e) =>
                      setLayerOpacity('landmarks', Number(e.target.value))
                    }
                    className="h-1.5 w-full cursor-pointer accent-orange-400"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Collapsible CBMS 15-Section Schema Reference */}
      <div className="border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={() => setShowSectionCatalog((prev) => !prev)}
          className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
        >
          <span>4. CBMS 15-Section Schema (312 Cols)</span>
          {showSectionCatalog ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showSectionCatalog && (
          <ul className="mt-2.5 space-y-1.5 text-xs">
            {CBMS_SECTIONS.map((sec) => (
              <li
                key={sec.code}
                className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">{sec.code}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {sec.level} • Cols {sec.columnRange[0]}–{sec.columnRange[1]}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">{sec.title}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};
