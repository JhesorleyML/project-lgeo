import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CBMS_REPORT_DIMENSIONS,
  CBMS_REPORT_INDICATORS,
  REPORT_INDICATOR_MAP,
  canAccessMemberData,
  canExportReportType,
  hasFullDataAccess,
  type BarangayAggregatedReportRow,
  type CbmsReportDimensionId,
  type HouseholdReportRosterRow,
  type MemberReportRosterRow,
  type ReportCriteriaMatchMode,
  type ReportExportFormat,
  type ReportIndicatorId,
  type ReportPreviewResponse,
  type ReportTypeId,
} from '@cbms/shared';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Lock,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useMapFilterStore } from '../store/useMapFilterStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

const SAN_JOSE_BARANGAY_OPTIONS = [
  { code: 'ALL', name: 'All 12 Barangays (Municipality of San Jose)' },
  { code: '1608506001', name: 'Brgy. Aurelio (1608506001)' },
  { code: '1608506002', name: 'Brgy. Cuarinta (1608506002)' },
  { code: '1608506003', name: 'Brgy. Don Ruben (1608506003)' },
  { code: '1608506004', name: 'Brgy. Jacquez (1608506004)' },
  { code: '1608506005', name: 'Brgy. Justiniana Edera (1608506005)' },
  { code: '1608506006', name: 'Brgy. Luna (1608506006)' },
  { code: '1608506007', name: 'Brgy. Mahayahay (1608506007)' },
  { code: '1608506008', name: 'Brgy. Matingbe (1608506008)' },
  { code: '1608506009', name: 'Brgy. Poblacion (1608506009)' },
  { code: '1608506010', name: 'Brgy. San Juan (1608506010)' },
  { code: '1608506011', name: 'Brgy. Sta Cruz (1608506011)' },
  { code: '1608506012', name: 'Brgy. Wilson (1608506012)' },
] as const;

interface ReportPresetTemplate {
  id: string;
  label: string;
  dimensionBadge: string;
  criteria: ReportIndicatorId[];
  matchMode: ReportCriteriaMatchMode;
  recommendedType: ReportTypeId;
}

const REPORT_PRESET_TEMPLATES: readonly ReportPresetTemplate[] = [
  {
    id: 'osy_education',
    label: 'Out-of-School Youth (OSY) Count & Roster',
    dimensionBadge: 'Sec D • Education',
    criteria: ['out_of_school_youth'],
    matchMode: 'all',
    recommendedType: 'BARANGAY_SUMMARY',
  },
  {
    id: 'four_ps_beneficiaries',
    label: '4Ps Beneficiaries Coverage Report',
    dimensionBadge: 'Sec M • Social Protection',
    criteria: ['beneficiary_4ps'],
    matchMode: 'all',
    recommendedType: 'BARANGAY_SUMMARY',
  },
  {
    id: 'four_ps_gap',
    label: '4Ps Undercoverage Gap (Poor HH Not in 4Ps)',
    dimensionBadge: 'Sec M + Poverty',
    criteria: ['no_4ps_poor'],
    matchMode: 'all',
    recommendedType: 'HOUSEHOLD_ROSTER',
  },
  {
    id: 'senior_pwd',
    label: 'Senior Citizens (60+) & PWD Vulnerability',
    dimensionBadge: 'Sec A & B • Demographics',
    criteria: ['senior_citizen', 'pwd'],
    matchMode: 'any',
    recommendedType: 'BARANGAY_SUMMARY',
  },
  {
    id: 'fisherfolk_farmers',
    label: 'Fisherfolk & Agricultural Farmers Livelihood',
    dimensionBadge: 'Sec E • Livelihood',
    criteria: ['fisherfolk', 'farmer'],
    matchMode: 'any',
    recommendedType: 'BARANGAY_SUMMARY',
  },
  {
    id: 'health_unmet',
    label: 'Unmet Medical Treatment & No PhilHealth',
    dimensionBadge: 'Sec F & M • Health',
    criteria: ['sick_without_treatment', 'no_philhealth'],
    matchMode: 'any',
    recommendedType: 'BARANGAY_SUMMARY',
  },
  {
    id: 'wash_housing_elec',
    label: 'Unimproved Water, Light Housing & No Electricity',
    dimensionBadge: 'Sec N & O • WASH/Housing',
    criteria: ['unimproved_water', 'makeshift_housing', 'no_electricity'],
    matchMode: 'any',
    recommendedType: 'BARANGAY_SUMMARY',
  },
  {
    id: 'climate_drrm',
    label: 'Climate/Typhoon Shock & Evacuation Awareness Gap',
    dimensionBadge: 'Sec J • DRRM',
    criteria: ['disaster_shock', 'unaware_evacuation_center'],
    matchMode: 'any',
    recommendedType: 'BARANGAY_SUMMARY',
  },
] as const;

export const ReportGeneratorPage: React.FC = () => {
  const {
    surveyYear,
    activeRole,
    activeVulnerabilityCriteria,
    dataRefreshVersion,
    setSurveyYear,
  } = useMapFilterStore();

  const fullAccess = hasFullDataAccess(activeRole);
  const canViewMembers = canAccessMemberData(activeRole);

  const [reportType, setReportType] = useState<ReportTypeId>('BARANGAY_SUMMARY');
  const [barangayGeoCode, setBarangayGeoCode] = useState<string>('ALL');
  const [selectedCriteria, setSelectedCriteria] = useState<ReportIndicatorId[]>(() =>
    activeVulnerabilityCriteria.filter((id) => REPORT_INDICATOR_MAP.has(id)),
  );
  const [matchMode, setMatchMode] = useState<ReportCriteriaMatchMode>('any');
  const [waiverOnly, setWaiverOnly] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [indicatorSearch, setIndicatorSearch] = useState<string>('');
  const [activeDimensionTab, setActiveDimensionTab] = useState<
    CbmsReportDimensionId | 'ALL'
  >('ALL');
  const [isExportingFormat, setIsExportingFormat] = useState<ReportExportFormat | null>(
    null,
  );
  const [exportStatusMsg, setExportStatusMsg] = useState<string | null>(null);
  const [exportErrorMsg, setExportErrorMsg] = useState<string | null>(null);

  // Enforce tiered RBAC: if role switches to STAFF while viewing HOUSEHOLD_ROSTER or MEMBER_ROSTER,
  // automatically switch to BARANGAY_SUMMARY (Aggregated Report)
  useEffect(() => {
    if (!canExportReportType(activeRole, reportType)) {
      setReportType('BARANGAY_SUMMARY');
    }
  }, [activeRole, reportType]);

  const toggleCriterion = (id: ReportIndicatorId) => {
    setSelectedCriteria((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const applyPreset = (preset: ReportPresetTemplate) => {
    setSelectedCriteria([...preset.criteria]);
    setMatchMode(preset.matchMode);
    if (canExportReportType(activeRole, preset.recommendedType)) {
      setReportType(preset.recommendedType);
    } else {
      setReportType('BARANGAY_SUMMARY');
    }
  };

  const queryParamsString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('surveyYear', String(surveyYear));
    params.set('reportType', reportType);
    params.set('barangayGeoCode', barangayGeoCode);
    if (selectedCriteria.length > 0) {
      params.set('criteria', selectedCriteria.join(','));
    }
    params.set('matchMode', matchMode);
    if (waiverOnly) {
      params.set('waiverOnly', 'true');
    }
    if (searchKeyword.trim()) {
      params.set('search', searchKeyword.trim());
    }
    params.set('limit', '100');
    return params.toString();
  }, [
    surveyYear,
    reportType,
    barangayGeoCode,
    selectedCriteria,
    matchMode,
    waiverOnly,
    searchKeyword,
  ]);

  const previewQuery = useQuery<ReportPreviewResponse>({
    queryKey: [
      'cbms-report-preview',
      queryParamsString,
      activeRole,
      dataRefreshVersion,
    ],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/reports/preview?${queryParamsString}`, {
        signal,
        headers: {
          'x-cbms-role': activeRole,
        },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.message || errBody.error || 'Failed to load CBMS report preview',
        );
      }
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  const handleExportDownload = async (format: ReportExportFormat) => {
    setExportErrorMsg(null);
    setExportStatusMsg(null);

    if (!canExportReportType(activeRole, reportType)) {
      setExportErrorMsg(
        `Role '${activeRole}' is authorized for Barangay Summary and Household-Level Roster exports only under RA 10173. Individual Member Rosters are restricted.`,
      );
      return;
    }

    setIsExportingFormat(format);
    try {
      const exportUrl = `${API_BASE}/reports/export?${queryParamsString}&format=${format}`;
      const res = await fetch(exportUrl, {
        headers: {
          'x-cbms-role': activeRole,
        },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.message || errBody.error || `Export failed (${res.status})`,
        );
      }

      const blob = await res.blob();
      const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const brgySlug = barangayGeoCode === 'ALL' ? 'AllBarangays' : barangayGeoCode;
      const fileName = `CBMS_${surveyYear}_${reportType}_SanJose_${brgySlug}_${dateStamp}.${format}`;

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      setExportStatusMsg(
        `Exported ${fileName} (${selectedCriteria.length} CBMS dimension filter${selectedCriteria.length === 1 ? '' : 's'} applied).`,
      );
    } catch (err) {
      setExportErrorMsg(
        err instanceof Error ? err.message : 'Failed to download report file',
      );
    } finally {
      setIsExportingFormat(null);
    }
  };

  const filteredDimensions = useMemo(() => {
    const cleanSearch = indicatorSearch.trim().toLowerCase();
    return CBMS_REPORT_DIMENSIONS.filter(
      (dim) => activeDimensionTab === 'ALL' || dim.id === activeDimensionTab,
    ).map((dim) => {
      const indicators = CBMS_REPORT_INDICATORS.filter((ind) => {
        if (ind.dimensionId !== dim.id) return false;
        if (!cleanSearch) return true;
        return (
          ind.label.toLowerCase().includes(cleanSearch) ||
          ind.shortLabel.toLowerCase().includes(cleanSearch) ||
          ind.columnRef.toLowerCase().includes(cleanSearch) ||
          ind.description.toLowerCase().includes(cleanSearch)
        );
      });
      return { dimension: dim, indicators };
    });
  }, [activeDimensionTab, indicatorSearch]);

  const summary = previewQuery.data?.summary;
  const barangayRows: BarangayAggregatedReportRow[] =
    previewQuery.data?.barangayRows ?? [];
  const householdRows: HouseholdReportRosterRow[] =
    previewQuery.data?.householdRows ?? [];
  const memberRows: MemberReportRosterRow[] =
    previewQuery.data?.memberRows ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      {/* Top Hero Header & Tiered RBAC Status Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                RA 11315 & RA 10173 Report Engine
              </span>
              <span
                className={`rounded px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  fullAccess
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                Active Clearance: {activeRole} (
                {fullAccess
                  ? 'Full Aggregated + Household & Member Rosters'
                  : 'Barangay Summaries + Household-Level Data • Member Data Restricted'}
                )
              </span>
              {summary && (
                <span
                  className={`rounded px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    summary.totalPopulationCovered > 0 || summary.totalHouseholdsCovered > 0
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {summary.totalPopulationCovered > 0 || summary.totalHouseholdsCovered > 0
                    ? `Live PostGIS ${surveyYear} Dataset`
                    : `No Uploaded Dataset for ${surveyYear} (0 Households)`}
                </span>
              )}
            </div>

            <h1 className="mt-2 text-xl font-bold text-white">
              Multi-Dimension CBMS Report Generator & Excel / CSV Exporter
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-slate-400">
              Filter across all <strong>8 Official CBMS Planning Dimensions</strong> (covering all{' '}
              <strong>15 Sections A–O + Poverty</strong>) with selective PostGIS table join
              pruning and <code className="text-sky-300">EXISTS</code> member semijoins. Export
              formatted Excel (<code className="text-emerald-300">.xlsx</code>), UTF-8 BOM CSV (
              <code className="text-sky-300">.csv</code>), or print official LGU tables.
            </p>
          </div>

          {/* Primary Export & Print Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleExportDownload('xlsx')}
              disabled={isExportingFormat !== null}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/50 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>
                {isExportingFormat === 'xlsx'
                  ? 'Generating Excel...'
                  : 'Export Excel (.xlsx)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleExportDownload('csv')}
              disabled={isExportingFormat !== null}
              className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-950/50 transition hover:bg-sky-500 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>
                {isExportingFormat === 'csv'
                  ? 'Generating CSV...'
                  : 'Export CSV (.csv)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <Printer className="h-4 w-4 text-slate-300" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Role Notice for STAFF */}
        {!fullAccess && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <strong>RA 10173 Data Privacy Tiered Access (STAFF Role):</strong> You are
              authorized to filter across all <strong>8 CBMS Dimensions</strong> and generate,
              print, and export <strong>Aggregated Barangay Summaries</strong> and{' '}
              <strong>Household-Level Rosters (Sections F–O + Poverty)</strong>. Individual
              Household Member Rosters and member-level PII (<code className="font-mono">Sections A–E</code>) are restricted and require{' '}
              <code className="font-mono">ADMIN</code>,{' '}
              <code className="font-mono">MUNICIPAL_STATISTICIAN</code>, or{' '}
              <code className="font-mono">MPDC</code> clearance.
            </div>
          </div>
        )}

        {exportStatusMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{exportStatusMsg}</span>
          </div>
        )}

        {exportErrorMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{exportErrorMsg}</span>
          </div>
        )}
      </div>

      {/* Step 1: Report Granularity / Output Mode Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card 1: Aggregated Barangay & Sectoral Summary (Open to ALL roles including STAFF) */}
        <button
          type="button"
          onClick={() => setReportType('BARANGAY_SUMMARY')}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            reportType === 'BARANGAY_SUMMARY'
              ? 'border-sky-500 bg-sky-500/15 ring-1 ring-sky-500/50'
              : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-2.5 py-1 text-[10px] font-bold text-sky-300">
                <Building2 className="h-3.5 w-3.5" />
                <span>1. Barangay Aggregated Summary</span>
              </span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                All Roles + STAFF
              </span>
            </div>
            <h3 className="mt-2.5 text-sm font-bold text-white">
              Aggregated Barangay & Sectoral Counts
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Statistical counts & percentages per Barangay (Out-of-School Youth, 4Ps
              Beneficiaries, Poor/Near-Poor, Seniors, PWDs, Livelihood, WASH). Contains zero PII.
            </p>
          </div>
          <div className="mt-3 text-[10px] font-semibold text-sky-400">
            {reportType === 'BARANGAY_SUMMARY' ? '● Active Report Mode' : 'Select Report Mode →'}
          </div>
        </button>

        {/* Card 2: Household Vulnerability & Beneficiary Roster (ADMIN, STAT, MPDC) */}
        <button
          type="button"
          onClick={() => {
            if (canExportReportType(activeRole, 'HOUSEHOLD_ROSTER')) {
              setReportType('HOUSEHOLD_ROSTER');
            }
          }}
          disabled={!canExportReportType(activeRole, 'HOUSEHOLD_ROSTER')}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            reportType === 'HOUSEHOLD_ROSTER'
              ? 'border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/50'
              : canExportReportType(activeRole, 'HOUSEHOLD_ROSTER')
                ? 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                : 'cursor-not-allowed border-slate-800/60 bg-slate-950/60 opacity-60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                <FileText className="h-3.5 w-3.5" />
                <span>2. Household Beneficiary Roster</span>
              </span>
              {canExportReportType(activeRole, 'HOUSEHOLD_ROSTER') ? (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  All Roles + STAFF
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                  <Lock className="h-3 w-3" />
                  <span>RA 10173 Locked</span>
                </span>
              )}
            </div>
            <h3 className="mt-2.5 text-sm font-bold text-white">
              Filtered Household Roster (Sections F–O + Poverty)
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              {canViewMembers
                ? '1 row per matching Household with Head Name, HUSN/HSN, Sitio/Purok, WGS84 GPS coordinates, Waiver status, and multi-dimension flags.'
                : '1 row per matching Household with HUSN/HSN, Sitio/Purok, HH Size, Poverty/4Ps, Utilities, WGS84 GPS coordinates, and Household-level flags (Member PII restricted).'}
            </p>
          </div>
          <div className="mt-3 text-[10px] font-semibold text-emerald-400">
            {!canExportReportType(activeRole, 'HOUSEHOLD_ROSTER')
              ? 'Restricted for STAFF under RA 10173'
              : reportType === 'HOUSEHOLD_ROSTER'
                ? '● Active Report Mode'
                : 'Select Report Mode →'}
          </div>
        </button>

        {/* Card 3: Individual Member & Sectoral Roster (ADMIN, STAT, MPDC) */}
        <button
          type="button"
          onClick={() => {
            if (canExportReportType(activeRole, 'MEMBER_ROSTER')) {
              setReportType('MEMBER_ROSTER');
            }
          }}
          disabled={!canExportReportType(activeRole, 'MEMBER_ROSTER')}
          className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
            reportType === 'MEMBER_ROSTER'
              ? 'border-indigo-500 bg-indigo-500/15 ring-1 ring-indigo-500/50'
              : canExportReportType(activeRole, 'MEMBER_ROSTER')
                ? 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                : 'cursor-not-allowed border-slate-800/60 bg-slate-950/60 opacity-60'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-[10px] font-bold text-indigo-300">
                <Users className="h-3.5 w-3.5" />
                <span>3. Individual Member Roster</span>
              </span>
              {canExportReportType(activeRole, 'MEMBER_ROSTER') ? (
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                  ADMIN / STAT / MPDC
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                  <Lock className="h-3 w-3" />
                  <span>RA 10173 Locked</span>
                </span>
              )}
            </div>
            <h3 className="mt-2.5 text-sm font-bold text-white">
              Individual Member Roster (Sections A–E)
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              1 row per matching Member (Out-of-School Youth individuals, Senior Citizens, PWDs,
              Solo Parents, Fisherfolk, Farmers) with Age, Sex, Education & Livelihood.
            </p>
          </div>
          <div className="mt-3 text-[10px] font-semibold text-indigo-400">
            {!canExportReportType(activeRole, 'MEMBER_ROSTER')
              ? 'Restricted for STAFF under RA 10173'
              : reportType === 'MEMBER_ROSTER'
                ? '● Active Report Mode'
                : 'Select Report Mode →'}
          </div>
        </button>
      </div>

      {/* Step 2: 1-Click LGU Sectoral Report Templates */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Quick LGU Sectoral Report Presets (1-Click Templates)</span>
          </div>
          {selectedCriteria.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCriteria([])}
              className="flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/25"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear All Criteria ({selectedCriteria.length})</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {REPORT_PRESET_TEMPLATES.map((preset) => {
            const isSelected =
              preset.criteria.length === selectedCriteria.length &&
              preset.criteria.every((c) => selectedCriteria.includes(c));
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-xs transition ${
                  isSelected
                    ? 'border-amber-500/60 bg-amber-500/15 text-white'
                    : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                }`}
              >
                <span className="font-semibold">{preset.label}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300">
                  {preset.dimensionBadge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 3: Scope Filters + 8-Dimension CBMS Indicator Catalog */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (4 cols): Geographic Scope, Match Logic & Selective Join Telemetry */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-4">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Filter className="h-4 w-4 text-sky-400" />
              <span>Geographic & Survey Scope</span>
            </h2>

            {/* Survey Year */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                CBMS Survey Year
              </label>
              <select
                value={surveyYear}
                onChange={(e) => setSurveyYear(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
              >
                <option value={2024}>2024 POPCEN-CBMS</option>
                <option value={2022}>2022 CBMS</option>
              </select>
            </div>

            {/* Barangay Selector */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Target Barangay (PSGC)
              </label>
              <select
                value={barangayGeoCode}
                onChange={(e) => setBarangayGeoCode(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
              >
                {SAN_JOSE_BARANGAY_OPTIONS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Multi-Criteria Match Logic (AND vs OR) */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Multi-Indicator Combination Logic
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMatchMode('all')}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    matchMode === 'all'
                      ? 'border-sky-500/60 bg-sky-500/15 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Match ALL (AND)
                </button>
                <button
                  type="button"
                  onClick={() => setMatchMode('any')}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    matchMode === 'any'
                      ? 'border-sky-500/60 bg-sky-500/15 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Match ANY (OR)
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                {matchMode === 'all'
                  ? 'AND: Records must satisfy every checked CBMS indicator simultaneously.'
                  : 'OR: Records matching at least one checked CBMS indicator are included.'}
              </p>
            </div>

            {/* Keyword Filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Search Barangay / Sitio / Head / HUSN
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="e.g., Purok 1, Aurelio, Fisherfolk..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* CBMS Form 3 Waiver Consent Filter */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
              <input
                type="checkbox"
                checked={waiverOnly}
                onChange={(e) => setWaiverOnly(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 accent-emerald-500"
              />
              <div>
                <div className="font-semibold text-slate-200">
                  CBMS Form 3 Waiver Consented Only
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  Filter to <code className="text-emerald-400">agree_to_sign_the_waiver = 1</code>{' '}
                  (Col 122) for inter-agency beneficiary data sharing.
                </div>
              </div>
            </label>
          </div>

          {/* PostGIS Selective Join Pruning Telemetry Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <Database className="h-4 w-4" />
              <span>PostGIS Selective Section Join Pruning</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Only tables required by your active dimension filters are joined; Member filters (
              <code className="text-sky-300">Sections A–E</code>) execute via{' '}
              <code className="text-sky-300">EXISTS</code> semijoins.
            </p>
            <div className="mt-3 space-y-2 text-[11px]">
              <div>
                <span className="text-slate-400">Active Criteria: </span>
                <span className="font-mono font-semibold text-white">
                  {selectedCriteria.length} / {CBMS_REPORT_INDICATORS.length}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Household Section Tables Joined: </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(summary?.prunedHouseholdTablesJoined.length ?? 0) > 0 ? (
                    summary!.prunedHouseholdTablesJoined.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      Baseline (households + barangays only)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Member Semijoin Tables (EXISTS): </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(summary?.prunedMemberTablesJoined.length ?? 0) > 0 ? (
                    summary!.prunedMemberTablesJoined.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-300"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      None (0 member joins needed)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (8 cols): 8-Dimension CBMS Indicator Selector (All 15 Sections A–O + Poverty) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
                <Layers className="h-4 w-4 text-sky-400" />
                <span>
                  8 CBMS Dimensions Filter Catalog (All 15 Sections A–O + Poverty)
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Check any combination of indicators across Demographics, Education, Health,
                Livelihood, Poverty, Social Protection, WASH/Housing, and DRRM.
              </p>
            </div>

            <div className="relative w-60">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={indicatorSearch}
                onChange={(e) => setIndicatorSearch(e.target.value)}
                placeholder="Filter 43 CBMS indicators..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-2.5 text-xs text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Dimension Filter Pills */}
          <div className="mb-4 flex flex-wrap gap-1.5 border-b border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveDimensionTab('ALL')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                activeDimensionTab === 'ALL'
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              All 8 Dimensions ({CBMS_REPORT_INDICATORS.length})
            </button>
            {CBMS_REPORT_DIMENSIONS.map((dim) => {
              const activeCountInDim = CBMS_REPORT_INDICATORS.filter(
                (i) => i.dimensionId === dim.id && selectedCriteria.includes(i.id),
              ).length;
              return (
                <button
                  key={dim.id}
                  type="button"
                  onClick={() => setActiveDimensionTab(dim.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    activeDimensionTab === dim.id
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{dim.shortTitle}</span>
                  {activeCountInDim > 0 && (
                    <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-bold text-white">
                      {activeCountInDim}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Scrollable 8-Dimension Indicator Checkboxes */}
          <div className="max-h-[430px] space-y-4 overflow-y-auto pr-1">
            {filteredDimensions.map(({ dimension, indicators }) => {
              if (indicators.length === 0) return null;
              return (
                <div
                  key={dimension.id}
                  className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-white">
                        {dimension.title}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        {dimension.description}
                      </p>
                    </div>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                      Sections: {dimension.sections.join(', ')}
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {indicators.map((ind) => {
                      const isChecked = selectedCriteria.includes(ind.id);
                      return (
                        <label
                          key={ind.id}
                          title={ind.description}
                          className={`flex cursor-pointer items-start justify-between gap-2 rounded-lg border p-2.5 text-xs transition ${
                            isChecked
                              ? 'border-sky-500/60 bg-sky-500/15 text-white'
                              : 'border-slate-800/80 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCriterion(ind.id)}
                              className="mt-0.5 rounded border-slate-700 accent-sky-500"
                            />
                            <div>
                              <div className="text-[11px] font-semibold leading-tight">
                                {ind.label}
                              </div>
                              <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                                {ind.columnRef}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                              ind.level === 'MEMBER'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {ind.level === 'MEMBER' ? 'Member' : 'HH'} • Sec{' '}
                            {ind.sectionCode}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step 4: Live Summary KPI Cards for Current Filter Selection */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-[11px] text-slate-400">
            {reportType === 'BARANGAY_SUMMARY'
              ? 'Matching Households Across Barangays'
              : reportType === 'HOUSEHOLD_ROSTER'
                ? 'Matching Households'
                : 'Matching Individual Members'}
          </div>
          <div className="mt-1.5 text-2xl font-bold text-white">
            {(reportType === 'BARANGAY_SUMMARY'
              ? (summary?.totalHouseholdsCovered ?? 0)
              : (summary?.totalMatchingRows ?? 0)
            ).toLocaleString()}
          </div>
          <div className="mt-1 text-[10px] text-sky-400">
            {selectedCriteria.length === 0
              ? 'All Enumerated Records'
              : `${selectedCriteria.length} CBMS Filter${selectedCriteria.length > 1 ? 's' : ''} (${matchMode.toUpperCase()})`}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-[11px] text-slate-400">Poor Households</div>
          <div className="mt-1.5 text-2xl font-bold text-rose-400">
            {(summary?.totalPoorHouseholds ?? 0).toLocaleString()}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Col 306 (poor = 1)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-[11px] text-slate-400">4Ps Beneficiaries</div>
          <div className="mt-1.5 text-2xl font-bold text-emerald-400">
            {(summary?.totalFourPsHouseholds ?? 0).toLocaleString()}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Section M (m05_a_4ps = 1)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-[11px] text-slate-400">
            Out-of-School Youth (OSY)
          </div>
          <div className="mt-1.5 text-2xl font-bold text-amber-400">
            {(summary?.totalOutOfSchoolYouth ?? 0).toLocaleString()}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Section D (Age 6–24 Not in School)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-[11px] text-slate-400">
            Senior Citizens / PWDs
          </div>
          <div className="mt-1.5 text-2xl font-bold text-indigo-400">
            {(summary?.totalSeniorCitizens ?? 0).toLocaleString()} /{' '}
            {(summary?.totalPwdMembers ?? 0).toLocaleString()}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Sections A & B (a05_age ≥ 60 / b10_pwd = 1)
          </div>
        </div>
      </div>

      {/* Step 5: Live Report Preview Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              Live Report Preview —{' '}
              {reportType === 'BARANGAY_SUMMARY'
                ? 'Aggregated Barangay & Sectoral Summary Matrix'
                : reportType === 'HOUSEHOLD_ROSTER'
                  ? 'Filtered Household Beneficiary Roster'
                  : 'Filtered Individual Member Roster'}
            </h2>
            <p className="text-xs text-slate-400">
              Showing preview of columns that will be written to your Excel (
              <code className="text-emerald-300">.xlsx</code>) or CSV (
              <code className="text-sky-300">.csv</code>) download.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-lg bg-slate-800 px-2.5 py-1 font-mono text-[11px] text-slate-300">
              {reportType === 'BARANGAY_SUMMARY'
                ? `${barangayRows.length} Barangay Rows`
                : reportType === 'HOUSEHOLD_ROSTER'
                  ? `Showing ${householdRows.length} of ${summary?.totalMatchingRows ?? 0} Households`
                  : `Showing ${memberRows.length} of ${summary?.totalMatchingRows ?? 0} Members`}
            </span>
          </div>
        </div>

        {/* Table 1: BARANGAY_SUMMARY (Accessible to ALL roles including STAFF) */}
        {reportType === 'BARANGAY_SUMMARY' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="pb-2.5 pr-3">Barangay (PSGC)</th>
                  <th className="pb-2.5 px-2 text-right">Total HH</th>
                  <th className="pb-2.5 px-2 text-right">Population</th>
                  <th className="pb-2.5 px-2 text-right text-sky-300">
                    Matching Filter
                  </th>
                  <th className="pb-2.5 px-2 text-right text-rose-300">
                    Poor HH (%)
                  </th>
                  <th className="pb-2.5 px-2 text-right text-emerald-300">
                    4Ps HH
                  </th>
                  <th className="pb-2.5 px-2 text-right text-amber-300">
                    4Ps Gap
                  </th>
                  <th className="pb-2.5 px-2 text-right text-amber-300">
                    OSY Count
                  </th>
                  <th className="pb-2.5 px-2 text-right">Seniors (60+)</th>
                  <th className="pb-2.5 px-2 text-right">PWD</th>
                  <th className="pb-2.5 px-2 text-right">Fisherfolk</th>
                  <th className="pb-2.5 px-2 text-right">Farmers</th>
                  {selectedCriteria.map((cId) => {
                    const meta = REPORT_INDICATOR_MAP.get(cId);
                    return (
                      <th
                        key={cId}
                        className="pb-2.5 pl-2 text-right text-sky-300"
                      >
                        [Filter] {meta?.shortLabel ?? cId}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {barangayRows.map((r) => (
                  <tr key={r.barangayGeoCode} className="hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold text-white">
                        Brgy. {r.barangayName}
                      </span>
                      <span className="ml-1.5 font-mono text-[10px] text-slate-500">
                        {r.barangayGeoCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-200">
                      {r.totalHouseholds.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                      {r.totalPopulation.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-sky-400">
                      {r.matchingHouseholds.toLocaleString()} ({r.matchingRate}%)
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-rose-400">
                      {r.poorHouseholds.toLocaleString()} ({r.poorRate}%)
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-400">
                      {r.fourPsHouseholds.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-amber-300">
                      {r.no4psPoorHouseholds.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-semibold text-amber-400">
                      {r.outOfSchoolYouthCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                      {r.seniorCitizensCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-indigo-300">
                      {r.pwdCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-sky-300">
                      {r.fisherfolkCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-300">
                      {r.farmerCount.toLocaleString()}
                    </td>
                    {selectedCriteria.map((cId) => (
                      <td
                        key={cId}
                        className="py-2.5 pl-2 text-right font-mono font-bold text-sky-300"
                      >
                        {(r.indicatorCounts[cId] ?? 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table 2: HOUSEHOLD_ROSTER (All Roles + STAFF; Member Name column hidden for STAFF) */}
        {reportType === 'HOUSEHOLD_ROSTER' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="pb-2.5 pr-3">Barangay & Sitio/Purok</th>
                  <th className="pb-2.5 px-2">HUSN / HSN</th>
                  {canViewMembers && (
                    <th className="pb-2.5 px-2">Household Head</th>
                  )}
                  <th className="pb-2.5 px-2 text-right">HH Size</th>
                  <th className="pb-2.5 px-2">Poverty & 4Ps</th>
                  <th className="pb-2.5 px-2">
                    {canViewMembers
                      ? 'Matched CBMS Dimension Flags'
                      : 'Matched Household-Level Flags'}
                  </th>
                  <th className="pb-2.5 px-2">Waiver (Col 122)</th>
                  <th className="pb-2.5 pl-2 text-right">WGS84 Coordinates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {householdRows.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-white">
                        Brgy. {h.barangayName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {h.sitioPurok} • {h.houseNumber}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-300">
                      {h.husn} / {h.hsn}
                    </td>
                    {canViewMembers && (
                      <td className="py-2.5 px-2 font-semibold text-slate-100">
                        {h.headName}
                      </td>
                    )}
                    <td className="py-2.5 px-2 text-right font-mono text-slate-200">
                      {h.hhSize} ({h.males}M / {h.females}F)
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            h.poor
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {h.poor ? 'Poor HH' : 'Non-Poor'}
                        </span>
                        {h.fourPsBeneficiary && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                            4Ps
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex flex-wrap gap-1">
                        {h.matchedIndicators.slice(0, 5).map((indId) => (
                          <span
                            key={indId}
                            className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300"
                          >
                            {REPORT_INDICATOR_MAP.get(indId)?.shortLabel ?? indId}
                          </span>
                        ))}
                        {h.matchedIndicators.length > 5 && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                            +{h.matchedIndicators.length - 5} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          h.waiverConsented
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {h.waiverConsented ? 'Signed' : 'No Waiver'}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono text-[10px] text-slate-400">
                      {h.longitude !== null && h.latitude !== null
                        ? `${h.longitude.toFixed(5)}, ${h.latitude.toFixed(5)}`
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table 3: MEMBER_ROSTER (ADMIN, MUNICIPAL_STATISTICIAN, MPDC) */}
        {reportType === 'MEMBER_ROSTER' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="pb-2.5 pr-3">Member Name (Line No.)</th>
                  <th className="pb-2.5 px-2">Barangay & Sitio</th>
                  <th className="pb-2.5 px-2">Sex / Age</th>
                  <th className="pb-2.5 px-2">Relation</th>
                  <th className="pb-2.5 px-2">Livelihood / Education</th>
                  <th className="pb-2.5 px-2">Sectoral & Vulnerability Flags</th>
                  <th className="pb-2.5 pl-2 text-right">HUSN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {memberRows.map((m) => (
                  <tr key={m.memberId} className="hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold text-white">
                        {m.lastName}, {m.firstName}
                      </span>
                      <span className="ml-1.5 font-mono text-[10px] text-slate-500">
                        #{m.lineNumber}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-slate-300">
                      Brgy. {m.barangayName} •{' '}
                      <span className="text-[10px] text-slate-400">
                        {m.sitioPurok}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-slate-200">
                      {m.sex} • {m.age} yrs
                    </td>
                    <td className="py-2.5 px-2 text-slate-300">
                      {m.relationToHead}
                    </td>
                    <td className="py-2.5 px-2 text-sky-300">{m.occupation}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex flex-wrap gap-1">
                        {m.isOutOfSchoolYouth && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                            OSY
                          </span>
                        )}
                        {m.isSeniorCitizen && (
                          <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                            Senior (60+)
                          </span>
                        )}
                        {m.isPwd && (
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                            PWD
                          </span>
                        )}
                        {m.isSoloParent && (
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple-300">
                            Solo Parent
                          </span>
                        )}
                        {m.isFisherfolk && (
                          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                            Fisherfolk
                          </span>
                        )}
                        {m.isFarmer && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                            Farmer
                          </span>
                        )}
                        {m.householdPoor && (
                          <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300">
                            Poor HH
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono text-[11px] text-slate-400">
                      {m.husn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
