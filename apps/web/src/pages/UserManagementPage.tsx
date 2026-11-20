import React from "react";
import { ShieldCheck, ShieldAlert, UserCheck } from "lucide-react";
import { hasFullDataAccess } from "@cbms/shared";
import { DEMO_LGU_ACCOUNTS, useAuthStore } from "../store/useAuthStore";

export const UserManagementPage: React.FC = () => {
  const { currentUser, loginAsRole } = useAuthStore();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
        <h1 className="text-lg font-bold text-white">
          LGU User Directory & Role-Based Access Control (RA 10173 & RA 11315)
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Separates full-clearance between user sessions where household names,
          serial numbers, and exact GPS points are masked.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {DEMO_LGU_ACCOUNTS.map((acc) => {
          const fullAccess = hasFullDataAccess(acc.role);
          const isCurrent = currentUser?.role === acc.role;
          return (
            <div
              key={acc.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 ${
                isCurrent
                  ? "border-sky-500/60 bg-sky-500/10"
                  : "border-slate-800 bg-slate-900/80"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">
                    {acc.fullName}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      fullAccess
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {acc.role}
                  </span>
                </div>
                <p className="mt-1 text-xs text-sky-400">{acc.designation}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {acc.department}
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  {acc.email}
                </p>

                <div
                  className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    fullAccess
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  {fullAccess ? (
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                  )}
                  <span>
                    {fullAccess
                      ? "Full Access: Household + Member Rosters (Sections A–O) & ETL Upload"
                      : "Tiered Access: Barangay & Household-Level Data (Member Sections A–E Restricted)"}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={() => loginAsRole(acc.role)}
                  disabled={isCurrent}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    isCurrent
                      ? "border border-sky-500/40 bg-sky-500/20 text-sky-200"
                      : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>
                    {isCurrent
                      ? "Active Session Role"
                      : `Switch Session to ${acc.role}`}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
