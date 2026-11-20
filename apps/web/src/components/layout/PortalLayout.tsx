import React from "react";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  GitCompareArrows,
  Globe2,
  Shield,
  Users,
} from "lucide-react";
import type { PortalPageId } from "@cbms/shared";
import { useMapFilterStore } from "../../store/useMapFilterStore";
import { UserProfileMenu } from "./UserProfileMenu";
import { ThemeToggleButton } from "./ThemeToggleButton";

interface PortalLayoutProps {
  children: React.ReactNode;
}

const PORTAL_NAV_ITEMS: Array<{
  id: Exclude<PortalPageId, "map">;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "dashboard",
    label: "Executive Dashboard",
    subtitle: "Socio-Economic & Spatial KPIs",
    icon: BarChart3,
  },
  {
    id: "uploads",
    label: "CBMS Data & ETL Upload",
    subtitle: "312-Column Excel / CSV Ingestion",
    icon: FileSpreadsheet,
  },
  {
    id: "reports",
    label: "Report Generation & Export",
    subtitle: "8-Dimension Excel / CSV Extracts",
    icon: Download,
  },
  {
    id: "yoy",
    label: "Multi-Year Comparison",
    subtitle: "Year-over-Year (YoY) Analytics",
    icon: GitCompareArrows,
  },
  {
    id: "users",
    label: "User & RBAC Access",
    subtitle: "RA 11315 & RA 10173 Clearance",
    icon: Users,
  },
];

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  const { activePage, surveyYear, setActivePage, setSurveyYear } =
    useMapFilterStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Left Portal Navigation Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900/95 p-4">
        <div>
          {/* LGU Brand Header */}
          <div className="mb-6 flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">
                CBMS Web-GIS
              </h1>
              <p className="text-[11px] text-slate-400">
                LGU San Jose, Dinagat Islands
              </p>
            </div>
          </div>

          {/* Dedicated Primary CTA to Open Full-Screen GIS Map Explorer */}
          <button
            type="button"
            onClick={() => setActivePage("map")}
            className="mb-5 flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-3.5 py-3 text-left text-xs font-bold text-white shadow-lg shadow-sky-900/30 transition hover:from-sky-500 hover:to-indigo-500"
          >
            <span className="flex items-center gap-2.5">
              <Globe2 className="h-4 w-4" />
              <span>Open Web-GIS Map</span>
            </span>
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
              Full Screen
            </span>
          </button>

          {/* Portal Page Navigation Links */}
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Decision Support Portal
          </p>
          <nav className="space-y-1">
            {PORTAL_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    isActive
                      ? "border border-sky-500/40 bg-sky-500/15 text-white"
                      : "border border-transparent text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? "text-sky-400" : "text-slate-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">
                      {item.label}
                    </div>
                    <div className="truncate text-[10px] text-slate-500">
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Compliance Footer */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <span>RA 11315 & RA 10173</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            PostGIS 3.4 Spatial Engine • 12 Barangays • 312 CBMS Survey Columns.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Portal Header */}
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-3">
          <div>
            <h2 className="text-base font-bold text-white">
              {PORTAL_NAV_ITEMS.find((i) => i.id === activePage)?.label ??
                "CBMS Decision Support Portal"}
            </h2>
            <p className="text-xs text-slate-400">
              Municipality of San Jose, Province of Dinagat Islands (PSGC
              1608506)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Active Survey Year:</span>
              <select
                value={surveyYear}
                onChange={(e) => setSurveyYear(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-100"
              >
                <option value={2024}>2024 POPCEN-CBMS</option>
                <option value={2022}>2022 CBMS</option>
              </select>
            </div>

            <ThemeToggleButton />
            <UserProfileMenu />
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};
