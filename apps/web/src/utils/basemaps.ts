import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'dark' | 'positron' | 'voyager' | 'osm' | 'satellite';

export interface BasemapOption {
  id: BasemapId;
  name: string;
  subtitle: string;
  swatchBg: string;
  swatchAccent: string;
  isLight: boolean;
}

export const BASEMAP_OPTIONS: readonly BasemapOption[] = [
  {
    id: 'dark',
    name: 'Dark Matter',
    subtitle: 'High-contrast analytics canvas',
    swatchBg: 'from-slate-950 via-slate-900 to-slate-800',
    swatchAccent: '#38bdf8',
    isLight: false,
  },
  {
    id: 'positron',
    name: 'Positron Light',
    subtitle: 'Clean daylight & report cartography',
    swatchBg: 'from-slate-100 via-slate-200 to-slate-300',
    swatchAccent: '#0284c7',
    isLight: true,
  },
  {
    id: 'voyager',
    name: 'Voyager Streets',
    subtitle: 'Topographic & street network context',
    swatchBg: 'from-amber-50 via-emerald-100 to-sky-200',
    swatchAccent: '#059669',
    isLight: true,
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    subtitle: 'Detailed community street & POI map',
    swatchBg: 'from-emerald-100 via-amber-100 to-sky-200',
    swatchAccent: '#16a34a',
    isLight: true,
  },
  {
    id: 'satellite',
    name: 'Satellite Hybrid',
    subtitle: 'Aerial imagery for coastal & roof audit',
    swatchBg: 'from-emerald-950 via-teal-900 to-sky-950',
    swatchAccent: '#f59e0b',
    isLight: false,
  },
] as const;

const CARTO_RASTER_API_KEY = (
  import.meta.env.VITE_CARTO_RASTER_API_KEY ?? ''
).trim();

function withCartoKey(url: string): string {
  if (!CARTO_RASTER_API_KEY) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}key=${encodeURIComponent(CARTO_RASTER_API_KEY)}`;
}

/**
 * Canonical Multi-Basemap StyleSpecification for MapLibre GL JS.
 * All 5 basemap sources and layers live at the bottom of the style stack so
 * switching basemaps is an instant `setLayoutProperty(..., 'visibility', ...)`
 * operation that never tears down custom PostGIS vector/GeoJSON sources.
 */
export const BASE_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: 'CBMS Web-GIS Multi-Basemap Canvas',
  glyphs: 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
  sources: {
    'basemap-dark': {
      type: 'raster',
      tiles: [
        withCartoKey('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'),
        withCartoKey('https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'),
        withCartoKey('https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'),
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
    'basemap-positron': {
      type: 'raster',
      tiles: [
        withCartoKey('https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'),
        withCartoKey('https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'),
        withCartoKey('https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'),
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
    'basemap-voyager': {
      type: 'raster',
      tiles: [
        withCartoKey('https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'),
        withCartoKey('https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'),
        withCartoKey('https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'),
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
    'basemap-osm': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
    'basemap-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
    },
    'basemap-satellite-labels': {
      type: 'raster',
      tiles: [
        withCartoKey(
          'https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
        ),
        withCartoKey(
          'https://b.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
        ),
      ],
      tileSize: 256,
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: 'cbms-base-bg',
      type: 'background',
      paint: {
        'background-color': '#020617',
      },
    },
    {
      id: 'basemap-layer-dark',
      type: 'raster',
      source: 'basemap-dark',
      layout: { visibility: 'visible' },
    },
    {
      id: 'basemap-layer-positron',
      type: 'raster',
      source: 'basemap-positron',
      layout: { visibility: 'none' },
    },
    {
      id: 'basemap-layer-voyager',
      type: 'raster',
      source: 'basemap-voyager',
      layout: { visibility: 'none' },
    },
    {
      id: 'basemap-layer-osm',
      type: 'raster',
      source: 'basemap-osm',
      layout: { visibility: 'none' },
    },
    {
      id: 'basemap-layer-satellite',
      type: 'raster',
      source: 'basemap-satellite',
      layout: { visibility: 'none' },
    },
    {
      id: 'basemap-layer-satellite-labels',
      type: 'raster',
      source: 'basemap-satellite-labels',
      layout: { visibility: 'none' },
    },
    // Z-Order Slot Anchors (bottom -> top: Land Use -> Choropleth -> Roads -> Catchment -> Brgy Labels -> Households -> Landmarks -> Measure)
    {
      id: 'cbms-slot-landuse',
      type: 'background',
      layout: { visibility: 'none' },
      paint: { 'background-opacity': 0 },
    },
    {
      id: 'cbms-slot-choropleth',
      type: 'background',
      layout: { visibility: 'none' },
      paint: { 'background-opacity': 0 },
    },
    {
      id: 'cbms-slot-roads',
      type: 'background',
      layout: { visibility: 'none' },
      paint: { 'background-opacity': 0 },
    },
    {
      id: 'cbms-slot-catchment',
      type: 'background',
      layout: { visibility: 'none' },
      paint: { 'background-opacity': 0 },
    },
    {
      id: 'cbms-slot-barangay-labels',
      type: 'background',
      layout: { visibility: 'none' },
      paint: { 'background-opacity': 0 },
    },
    {
      id: 'cbms-slot-households',
      type: 'background',
      layout: { visibility: 'none' },
      paint: { 'background-opacity': 0 },
    },
    {
      id: 'cbms-slot-landmarks',
      type: 'background',
      layout: { visibility: 'none' },
      paint: { 'background-opacity': 0 },
    },
    {
      id: 'cbms-slot-measure',
      type: 'background',
      layout: { visibility: 'none' },
      paint: { 'background-opacity': 0 },
    },
  ],
};

export function getBasemapById(id: BasemapId): BasemapOption {
  return BASEMAP_OPTIONS.find((b) => b.id === id) ?? BASEMAP_OPTIONS[0]!;
}
