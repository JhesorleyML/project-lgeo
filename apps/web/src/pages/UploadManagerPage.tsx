import React, { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Globe2,
  Loader2,
  Play,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import {
  CBMS_SECTIONS,
  hasFullDataAccess,
  type SurveyYearSummary,
  type UploadBatchSummary,
} from "@cbms/shared";
import { useMapFilterStore } from "../store/useMapFilterStore";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

interface BatchesApiResponse {
  surveyYears: SurveyYearSummary[];
  batches: UploadBatchSummary[];
}

type PendingConfirmAction =
  | {
      type: "ROLLBACK_BATCH";
      batch: UploadBatchSummary;
    }
  | {
      type: "CLEAR_SURVEY_YEAR";
      surveyYearSummary: SurveyYearSummary;
    };

export const UploadManagerPage: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    activeRole,
    surveyYear,
    setSurveyYear,
    setActivePage,
    bumpDataRefreshVersion,
  } = useMapFilterStore();

  const fullAccess = hasFullDataAccess(activeRole);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetYear, setTargetYear] = useState<number>(surveyYear);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] =
    useState<PendingConfirmAction | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState<boolean>(false);

  // Fetch all Survey Years and recent Upload Batches
  const batchesQuery = useQuery<BatchesApiResponse>({
    queryKey: ["etl-batches"],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/etl/batches`, { signal });
      if (!res.ok) throw new Error("Failed to load ETL batches");
      return res.json();
    },
    refetchInterval: activeBatchId ? 1000 : 5000,
  });

  // Poll active batch status in real time while PROCESSING
  const activeBatchQuery = useQuery<UploadBatchSummary>({
    queryKey: ["etl-batch-detail", activeBatchId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${API_BASE}/etl/batches/${activeBatchId}`, {
        signal,
      });
      if (!res.ok) throw new Error("Failed to fetch batch progress");
      return res.json();
    },
    enabled: Boolean(activeBatchId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "PROCESSING" ? 750 : false;
    },
  });

  // When an active batch transitions to COMPLETED or FAILED, refresh GIS caches
  useEffect(() => {
    const status = activeBatchQuery.data?.status;
    if (status === "COMPLETED" || status === "FAILED") {
      bumpDataRefreshVersion();
      queryClient.invalidateQueries({ queryKey: ["etl-batches"] });
      queryClient.invalidateQueries({ queryKey: ["gis-choropleth"] });
    }
  }, [activeBatchQuery.data?.status, bumpDataRefreshVersion, queryClient]);

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setActionError("Please choose a CBMS .xlsx or .csv file first.");
      return;
    }

    setActionError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("surveyYear", String(targetYear));
      formData.append("replaceExisting", String(replaceExisting));
      formData.append("role", activeRole);

      const res = await fetch(`${API_BASE}/etl/upload`, {
        method: "POST",
        headers: {
          "x-cbms-role": activeRole,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start upload");
      }

      setActiveBatchId(data.batchId);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["etl-batches"] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportWorkspaceSample = async () => {
    setActionError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/etl/import-workspace-sample`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cbms-role": activeRole,
        },
        body: JSON.stringify({
          surveyYear: targetYear,
          replaceExisting,
          role: activeRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start workspace ETL");
      }
      setActiveBatchId(data.batchId);
      queryClient.invalidateQueries({ queryKey: ["etl-batches"] });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Workspace import failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRollbackBatch = async (batchId: string) => {
    setActionError(null);
    setIsConfirmingAction(true);
    try {
      const res = await fetch(`${API_BASE}/etl/batches/${batchId}`, {
        method: "DELETE",
        headers: { "x-cbms-role": activeRole },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Rollback failed");
      }
      setConfirmAction(null);
      bumpDataRefreshVersion();
      queryClient.invalidateQueries({ queryKey: ["etl-batches"] });
      queryClient.invalidateQueries({ queryKey: ["gis-choropleth"] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setIsConfirmingAction(false);
    }
  };

  const handleClearSurveyYear = async (year: number) => {
    setActionError(null);
    setIsConfirmingAction(true);
    try {
      const res = await fetch(`${API_BASE}/etl/years/${year}`, {
        method: "DELETE",
        headers: { "x-cbms-role": activeRole },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to clear survey year");
      }
      setConfirmAction(null);
      bumpDataRefreshVersion();
      queryClient.invalidateQueries({ queryKey: ["etl-batches"] });
      queryClient.invalidateQueries({ queryKey: ["gis-choropleth"] });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to clear year",
      );
    } finally {
      setIsConfirmingAction(false);
    }
  };

  const liveBatch =
    activeBatchQuery.data ??
    batchesQuery.data?.batches.find(
      (b) => b.status === "PROCESSING" || b.status === "PENDING",
    ) ??
    batchesQuery.data?.batches[0] ??
    null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
              Worker Thread Streaming ETL
            </span>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              312 Columns → 17 PostGIS Tables
            </span>
          </div>
          <h1 className="mt-1.5 text-lg font-bold text-white">
            CBMS Survey Excel / CSV Upload & Spatial Ingestion Pipeline
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            De-duplicates flat member rows by{" "}
            <code className="text-sky-300">(survey_year_id, cbms_uuid)</code>,
            populates Sections A–O + Poverty, computes{" "}
            <code className="text-emerald-300">geom_point (EPSG:4326)</code>,
            and refreshes{" "}
            <code className="text-indigo-300">
              mv_barangay_yearly_indicators
            </code>
            .
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActivePage("map")}
          className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500"
        >
          <Globe2 className="h-4 w-4" />
          <span>View Results on Web-GIS Map</span>
        </button>
      </div>

      {!fullAccess && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 p-4 text-xs text-amber-200">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <strong>RBAC Restriction (RA 10173):</strong> Your current session
            role is <strong>{activeRole}</strong>. Only <strong>ADMIN</strong>,{" "}
            <strong>MUNICIPAL_STATISTICIAN</strong>, and <strong>MPDC</strong>{" "}
            roles are permitted to upload or rollback CBMS survey batches. Use
            the User Profile menu in the top-right to switch roles.
          </div>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-xs text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Grid: Upload Form + Live Streaming ETL Telemetry */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Upload & Configuration Panel (7 cols) */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-7">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <FileSpreadsheet className="h-4 w-4 text-sky-400" />
            <span>1. Upload CBMS 312-Column Dataset (.xlsx)</span>
          </h2>

          <form onSubmit={handleUploadFile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Target Survey Year Snapshot
                </label>
                <select
                  value={targetYear}
                  onChange={(e) => {
                    const yr = Number(e.target.value);
                    setTargetYear(yr);
                    setSurveyYear(yr);
                  }}
                  disabled={!fullAccess || isSubmitting}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value={2024}>2024 POPCEN-CBMS</option>
                  <option value={2022}>2022 CBMS Survey</option>
                  <option value={2027}>2027 CBMS Cycle</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  De-duplication & Conflict Mode
                </label>
                <select
                  value={replaceExisting ? "replace" : "upsert"}
                  onChange={(e) =>
                    setReplaceExisting(e.target.value === "replace")
                  }
                  disabled={!fullAccess || isSubmitting}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="upsert">
                    Idempotent Upsert (Merge by cbms_uuid)
                  </option>
                  <option value="replace">
                    Replace Survey Year Snapshot Before Import
                  </option>
                </select>
              </div>
            </div>

            {/* File Dropzone */}
            <div
              onClick={() => fullAccess && fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
                selectedFile
                  ? "border-emerald-500/60 bg-emerald-500/10"
                  : "border-slate-700 bg-slate-950/60 hover:border-sky-500/60 hover:bg-slate-900"
              } ${!fullAccess ? "pointer-events-none opacity-50" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <Upload className="mb-2 h-7 w-7 text-sky-400" />
              {selectedFile ? (
                <div>
                  <p className="text-xs font-bold text-emerald-300">
                    {selectedFile.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready
                    for 312-Column Streaming Ingestion
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    Click to select a CBMS Excel (`.xlsx`) or CSV (`.csv`) file
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Supports official 312-column PSA CBMS exports (up to 150 MB)
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!fullAccess || !selectedFile || isSubmitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>Upload & Run 312-Column ETL</span>
              </button>

              <button
                type="button"
                onClick={handleImportWorkspaceSample}
                disabled={!fullAccess || isSubmitting}
                className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/50 bg-sky-500/15 px-4 py-2.5 text-xs font-bold text-sky-300 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Run ETL on docs/CBMS_data.xlsx (26,701 rows)</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right: Live ETL Worker Telemetry & Survey Year Dataset Status (5 cols) */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <Database className="h-4 w-4 text-emerald-400" />
            <span>2. Live ETL Worker Telemetry & Year Status</span>
          </h2>

          {liveBatch ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white">
                    {liveBatch.fileName}
                  </span>
                  <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                    {liveBatch.surveyYear}
                  </span>
                </div>
                <span
                  className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    liveBatch.status === "COMPLETED"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : liveBatch.status === "PROCESSING" ||
                          liveBatch.status === "PENDING"
                        ? "bg-sky-500/20 text-sky-300"
                        : liveBatch.status === "ROLLED_BACK"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {(liveBatch.status === "PROCESSING" ||
                    liveBatch.status === "PENDING") && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {liveBatch.status === "COMPLETED" && (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {liveBatch.status}
                </span>
              </div>

              {/* Progress Counters */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
                  <div className="text-sm font-bold text-white">
                    {liveBatch.totalRowsRead.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Flat Rows Read
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
                  <div className="text-sm font-bold text-emerald-400">
                    {liveBatch.householdsImported.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Unique Households
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
                  <div className="text-sm font-bold text-sky-400">
                    {liveBatch.membersImported.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Members (Sec A–E)
                  </div>
                </div>
              </div>

              {/* Spatial Audit Warnings */}
              {liveBatch.errorLog && liveBatch.errorLog.length > 0 && (
                <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                  <div className="mb-1 font-semibold text-amber-300">
                    Spatial & Schema Audit Log ({liveBatch.errorLog.length}):
                  </div>
                  {liveBatch.errorLog.slice(0, 5).map((w, idx) => (
                    <div key={idx} className="truncate text-[10px]">
                      • [{w.code}] {w.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
              No ETL upload batches have been run yet. Currently serving the 48
              spatially-verified sample households on the Web-GIS map.
            </div>
          )}

          {/* Active Survey Year Database Counts & Reset Controls */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              PostgreSQL + PostGIS Survey Year Snapshots
            </h3>
            {(batchesQuery.data?.surveyYears ?? []).map((sy) => (
              <div
                key={sy.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-xs"
              >
                <div>
                  <div className="font-bold text-white">
                    {sy.surveyYear} — {sy.title}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {sy.householdCount > 0 ? (
                      <span className="text-emerald-400">
                        {sy.householdCount.toLocaleString()} Households •{" "}
                        {sy.memberCount.toLocaleString()} Members in PostGIS
                      </span>
                    ) : (
                      <span className="text-amber-300">0 DB Households</span>
                    )}
                  </div>
                </div>

                {sy.householdCount > 0 && fullAccess && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        type: "CLEAR_SURVEY_YEAR",
                        surveyYearSummary: sy,
                      })
                    }
                    className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/25"
                    title="Clear imported CBMS households from the current year"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to 0 HH</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upload Batch History & 17-Table Normalization Reference */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Batch History Table (7 cols) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-7">
          <h2 className="mb-3 text-sm font-bold text-white">
            Recent Upload Batches (`upload_batches`)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="pb-2">File & Year</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Rows</th>
                  <th className="pb-2 text-right">Households</th>
                  <th className="pb-2 text-right">Members</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {batchesQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-xs text-slate-400"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                        Loading recent upload batches from PostGIS...
                      </span>
                    </td>
                  </tr>
                ) : batchesQuery.isError ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-xs text-rose-300"
                    >
                      Failed to load upload batches. Check backend connection
                      (`/api/v1/etl/batches`).
                    </td>
                  </tr>
                ) : (batchesQuery.data?.batches ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-xs text-slate-500"
                    >
                      No upload batches recorded yet.
                    </td>
                  </tr>
                ) : (
                  (batchesQuery.data?.batches ?? []).map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5">
                        <div className="font-semibold text-slate-200">
                          {b.fileName}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Year {b.surveyYear} •{" "}
                          {new Date(b.uploadedAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            b.status === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : b.status === "PROCESSING"
                                ? "bg-sky-500/20 text-sky-300"
                                : b.status === "ROLLED_BACK"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-300">
                        {b.totalRowsRead.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right font-mono text-emerald-400">
                        {b.householdsImported.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right font-mono text-sky-400">
                        {b.membersImported.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right">
                        {b.status === "COMPLETED" && fullAccess && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                type: "ROLLBACK_BATCH",
                                batch: b,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Rollback</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 17-Table Normalization Summary (5 cols) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 lg:col-span-5">
          <h2 className="mb-2 text-sm font-bold text-white">
            Normalized Target Schema (15 Domain Sections)
          </h2>
          <p className="mb-3 text-[11px] text-slate-400">
            Every 312-column row is partitioned into `households`,
            `household_members`, and these 15 1:1 domain tables:
          </p>
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {CBMS_SECTIONS.map((sec) => (
              <div
                key={sec.code}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-[11px]"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-200">
                    {sec.title}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {sec.tableName}
                  </div>
                </div>
                <span className="ml-2 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300">
                  Cols {sec.columnRange[0]}–{sec.columnRange[1]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Batch Rollback & Survey Year Reset */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-rose-500/40 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white">
                  {confirmAction.type === "ROLLBACK_BATCH"
                    ? `Confirm Upload Batch Rollback (${confirmAction.batch.fileName})`
                    : `Confirm Reset Survey Year ${confirmAction.surveyYearSummary.surveyYear} to 0 Households`}
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  {confirmAction.type === "ROLLBACK_BATCH" ? (
                    <>
                      You are about to roll back batch{" "}
                      <span className="font-semibold text-white">
                        {confirmAction.batch.fileName}
                      </span>{" "}
                      uploaded for Survey Year{" "}
                      <span className="font-semibold text-sky-300">
                        {confirmAction.batch.surveyYear}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      You are about to clear all CBMS records for Survey Year{" "}
                      <span className="font-semibold text-sky-300">
                        {confirmAction.surveyYearSummary.surveyYear} —{" "}
                        {confirmAction.surveyYearSummary.title}
                      </span>
                      .
                    </>
                  )}
                </p>

                <div className="mt-3 space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 text-[11px] text-slate-300">
                  <div className="font-semibold text-rose-300">
                    What this action will do:
                  </div>
                  {confirmAction.type === "ROLLBACK_BATCH" ? (
                    <ul className="list-disc space-y-1 pl-4">
                      <li>
                        Permanently removes{" "}
                        <strong className="text-emerald-300">
                          {confirmAction.batch.householdsImported.toLocaleString()}{" "}
                          households
                        </strong>{" "}
                        and{" "}
                        <strong className="text-sky-300">
                          {confirmAction.batch.membersImported.toLocaleString()}{" "}
                          members
                        </strong>{" "}
                        (including all 15 CBMS domain tables:{" "}
                        <code>Sections A–O + Poverty</code>) linked to this
                        batch ID.
                      </li>
                      <li>
                        Marks this upload batch status as{" "}
                        <code className="text-amber-300">ROLLED_BACK</code> in{" "}
                        <code>upload_batches</code>.
                      </li>
                      <li>
                        Refreshes{" "}
                        <code className="text-indigo-300">
                          mv_barangay_yearly_indicators
                        </code>{" "}
                        to update Barangay choropleth rates and Web-GIS vector
                        tiles.
                      </li>
                      <li>
                        <strong className="text-slate-100">
                          Isolated Scope:
                        </strong>{" "}
                        Does not affect households imported by other batches or
                        datasets in other Survey Years.
                      </li>
                    </ul>
                  ) : (
                    <ul className="list-disc space-y-1 pl-4">
                      <li>
                        Permanently deletes all{" "}
                        <strong className="text-emerald-300">
                          {confirmAction.surveyYearSummary.householdCount.toLocaleString()}{" "}
                          households
                        </strong>{" "}
                        and{" "}
                        <strong className="text-sky-300">
                          {confirmAction.surveyYearSummary.memberCount.toLocaleString()}{" "}
                          members
                        </strong>{" "}
                        across all 17 normalized PostGIS tables for Survey Year{" "}
                        <strong>
                          {confirmAction.surveyYearSummary.surveyYear}
                        </strong>
                        .
                      </li>
                      <li>
                        Marks all completed upload batches for Survey Year{" "}
                        <strong>
                          {confirmAction.surveyYearSummary.surveyYear}
                        </strong>{" "}
                        as <code className="text-amber-300">ROLLED_BACK</code>.
                      </li>
                      <li>
                        Refreshes{" "}
                        <code className="text-indigo-300">
                          mv_barangay_yearly_indicators
                        </code>{" "}
                        so Barangay choropleth layers and vector tiles reflect{" "}
                        <code>0 DB Households</code> for this year.
                      </li>
                      <li>
                        <strong className="text-slate-100">
                          Multi-Year Isolation:
                        </strong>{" "}
                        Other Survey Years (e.g., 2022, 2025, 2027) remain
                        completely untouched.
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isConfirmingAction}
                onClick={() => setConfirmAction(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isConfirmingAction}
                onClick={() => {
                  if (confirmAction.type === "ROLLBACK_BATCH") {
                    handleRollbackBatch(confirmAction.batch.id);
                  } else {
                    handleClearSurveyYear(
                      confirmAction.surveyYearSummary.surveyYear,
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-950/50 transition hover:bg-rose-500 disabled:opacity-50"
              >
                {isConfirmingAction ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>
                  {confirmAction.type === "ROLLBACK_BATCH"
                    ? "Yes, Rollback This Batch"
                    : `Yes, Reset ${confirmAction.surveyYearSummary.surveyYear} to 0 HH`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
