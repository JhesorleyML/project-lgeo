import { create } from "zustand";
import type {
  AiMapAction,
  HeadlineChoroplethMetricId,
  LandmarkSectorId,
  PortalPageId,
  RoadColorMode,
  UserRole,
  VulnerabilityCriterionId,
} from "@cbms/shared";
import type { BasemapId } from "../utils/basemaps";

export type MeasureMode = "none" | "distance" | "area";
export type CoordFormat = "dd" | "dms";
export type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "cbms-ui-theme";

function getInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const mode: ThemeMode = stored === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", mode);
    return mode;
  } catch {
    return "dark";
  }
}

function applyThemeToDom(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  try {
    document.documentElement.setAttribute("data-theme", mode);
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export interface LayerOpacities {
  choropleth: number;
  landUse: number;
  roads: number;
  landmarks: number;
  households: number;
}

interface MapFilterState {
  activePage: PortalPageId;
  themeMode: ThemeMode;
  surveyYear: number;
  selectedMetric: HeadlineChoroplethMetricId;
  activeRole: UserRole;
  basemapId: BasemapId;
  isSidebarCollapsed: boolean;
  isLegendCollapsed: boolean;
  showChoropleth: boolean;
  showBarangayLabels: boolean;
  showLandUse: boolean;
  showRoads: boolean;
  roadColorMode: RoadColorMode;
  showLandmarks: boolean;
  selectedLandmarkSector: LandmarkSectorId;
  showHouseholdPoints: boolean;
  layerOpacities: LayerOpacities;
  measureMode: MeasureMode;
  coordFormat: CoordFormat;
  activeCatchmentLandmarkId: number | null;
  catchmentRadiusMeters: number;
  activeVulnerabilityCriteria: VulnerabilityCriterionId[];
  dataRefreshVersion: number;
  isAiDrawerOpen: boolean;
  setActivePage: (page: PortalPageId) => void;
  setAiDrawerOpen: (open: boolean) => void;
  toggleAiDrawer: () => void;
  applyAiMapAction: (action: AiMapAction) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  setSurveyYear: (year: number) => void;
  setSelectedMetric: (metric: HeadlineChoroplethMetricId) => void;
  setActiveRole: (role: UserRole) => void;
  setBasemapId: (basemapId: BasemapId) => void;
  toggleSidebarCollapsed: () => void;
  toggleLegendCollapsed: () => void;
  toggleChoropleth: () => void;
  toggleBarangayLabels: () => void;
  toggleLandUse: () => void;
  toggleRoads: () => void;
  setRoadColorMode: (mode: RoadColorMode) => void;
  toggleLandmarks: () => void;
  setSelectedLandmarkSector: (sector: LandmarkSectorId) => void;
  toggleHouseholdPoints: () => void;
  setLayerOpacity: (layer: keyof LayerOpacities, opacity: number) => void;
  setMeasureMode: (mode: MeasureMode) => void;
  toggleCoordFormat: () => void;
  setActiveCatchment: (
    landmarkId: number | null,
    radiusMeters?: number,
  ) => void;
  toggleVulnerabilityCriterion: (id: VulnerabilityCriterionId) => void;
  clearVulnerabilityCriteria: () => void;
  bumpDataRefreshVersion: () => void;
}

const initialTheme = getInitialThemeMode();

export const useMapFilterStore = create<MapFilterState>((set) => ({
  activePage: "dashboard",
  themeMode: initialTheme,
  surveyYear: 2024,
  selectedMetric: "poor_rate",
  activeRole: "ADMIN",
  basemapId: initialTheme === "light" ? "positron" : "dark",
  isSidebarCollapsed: false,
  isLegendCollapsed: false,
  showChoropleth: true,
  showBarangayLabels: true,
  showLandUse: false,
  showRoads: true,
  roadColorMode: "class",
  showLandmarks: false,
  selectedLandmarkSector: "ALL",
  showHouseholdPoints: false,
  layerOpacities: {
    choropleth: 0.9,
    landUse: 0.45,
    roads: 0.92,
    landmarks: 0.95,
    households: 0.9,
  },
  measureMode: "none",
  coordFormat: "dd",
  activeCatchmentLandmarkId: null,
  catchmentRadiusMeters: 500,
  activeVulnerabilityCriteria: [],
  dataRefreshVersion: 1,
  isAiDrawerOpen: false,
  setActivePage: (activePage) => set({ activePage }),
  setAiDrawerOpen: (isAiDrawerOpen) => set({ isAiDrawerOpen }),
  toggleAiDrawer: () => set((s) => ({ isAiDrawerOpen: !s.isAiDrawerOpen })),
  applyAiMapAction: (action) =>
    set((s) => ({
      activePage: action.targetPage ?? "map",
      surveyYear: action.surveyYear ?? s.surveyYear,
      selectedMetric: action.choroplethMetric ?? s.selectedMetric,
      showChoropleth: action.choroplethMetric ? true : s.showChoropleth,
      activeVulnerabilityCriteria:
        action.vulnerabilityCriteria ?? s.activeVulnerabilityCriteria,
      showHouseholdPoints:
        action.vulnerabilityCriteria && action.vulnerabilityCriteria.length > 0
          ? true
          : s.showHouseholdPoints,
      selectedLandmarkSector:
        action.landmarkSector ?? s.selectedLandmarkSector,
      showLandmarks:
        action.landmarkSector || action.catchmentLandmarkId
          ? true
          : s.showLandmarks,
      activeCatchmentLandmarkId:
        action.catchmentLandmarkId !== undefined
          ? action.catchmentLandmarkId
          : s.activeCatchmentLandmarkId,
      catchmentRadiusMeters:
        action.catchmentRadiusMeters ?? s.catchmentRadiusMeters,
      showLandUse:
        action.enableLandUse !== undefined
          ? action.enableLandUse
          : s.showLandUse,
      showRoads:
        action.enableRoads !== undefined ? action.enableRoads : s.showRoads,
    })),
  setThemeMode: (themeMode) =>
    set((s) => {
      applyThemeToDom(themeMode);
      const nextBasemap: BasemapId =
        themeMode === "light" && s.basemapId === "dark"
          ? "positron"
          : themeMode === "dark" && s.basemapId === "positron"
            ? "dark"
            : s.basemapId;
      return { themeMode, basemapId: nextBasemap };
    }),
  toggleThemeMode: () =>
    set((s) => {
      const nextTheme: ThemeMode = s.themeMode === "dark" ? "light" : "dark";
      applyThemeToDom(nextTheme);
      const nextBasemap: BasemapId =
        nextTheme === "light" && s.basemapId === "dark"
          ? "positron"
          : nextTheme === "dark" && s.basemapId === "positron"
            ? "dark"
            : s.basemapId;
      return { themeMode: nextTheme, basemapId: nextBasemap };
    }),
  setSurveyYear: (surveyYear) => set({ surveyYear }),
  setSelectedMetric: (selectedMetric) => set({ selectedMetric }),
  setActiveRole: (activeRole) => set({ activeRole }),
  setBasemapId: (basemapId) => set({ basemapId }),
  toggleSidebarCollapsed: () =>
    set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
  toggleLegendCollapsed: () =>
    set((s) => ({ isLegendCollapsed: !s.isLegendCollapsed })),
  toggleChoropleth: () => set((s) => ({ showChoropleth: !s.showChoropleth })),
  toggleBarangayLabels: () =>
    set((s) => ({ showBarangayLabels: !s.showBarangayLabels })),
  toggleLandUse: () => set((s) => ({ showLandUse: !s.showLandUse })),
  toggleRoads: () => set((s) => ({ showRoads: !s.showRoads })),
  setRoadColorMode: (roadColorMode) => set({ roadColorMode }),
  toggleLandmarks: () => set((s) => ({ showLandmarks: !s.showLandmarks })),
  setSelectedLandmarkSector: (selectedLandmarkSector) =>
    set({ selectedLandmarkSector }),
  toggleHouseholdPoints: () =>
    set((s) => ({ showHouseholdPoints: !s.showHouseholdPoints })),
  setLayerOpacity: (layer, opacity) =>
    set((s) => ({
      layerOpacities: {
        ...s.layerOpacities,
        [layer]: Math.min(1, Math.max(0.05, opacity)),
      },
    })),
  setMeasureMode: (measureMode) => set({ measureMode }),
  toggleCoordFormat: () =>
    set((s) => ({ coordFormat: s.coordFormat === "dd" ? "dms" : "dd" })),
  setActiveCatchment: (landmarkId, radiusMeters) =>
    set((s) => ({
      activeCatchmentLandmarkId: landmarkId,
      catchmentRadiusMeters: radiusMeters ?? s.catchmentRadiusMeters,
    })),
  toggleVulnerabilityCriterion: (id) =>
    set((s) => ({
      activeVulnerabilityCriteria: s.activeVulnerabilityCriteria.includes(id)
        ? s.activeVulnerabilityCriteria.filter((c) => c !== id)
        : [...s.activeVulnerabilityCriteria, id],
    })),
  clearVulnerabilityCriteria: () => set({ activeVulnerabilityCriteria: [] }),
  bumpDataRefreshVersion: () =>
    set((s) => ({ dataRefreshVersion: s.dataRefreshVersion + 1 })),
}));
