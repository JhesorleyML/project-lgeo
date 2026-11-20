import React, { useState } from "react";
import {
  Globe2,
  Lock,
  Mail,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { hasFullDataAccess } from "@cbms/shared";
import { DEMO_LGU_ACCOUNTS, useAuthStore } from "../store/useAuthStore";
import { ThemeToggleButton } from "../components/layout/ThemeToggleButton";

export const LoginPage: React.FC = () => {
  const { loginAsRole, loginWithEmail } = useAuthStore();
  const [email, setEmail] = useState(DEMO_LGU_ACCOUNTS[0]!.email);
  const [password, setPassword] = useState("cbms-sanjose-2024");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Please enter your official LGU email and password.");
      return;
    }
    const ok = loginWithEmail(email);
    if (!ok) {
      setError("Unrecognized LGU account email.");
    }
  };

  return (
    <div className="relative flex min-h-screen w-screen flex-col justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggleButton />
      </div>
      <div className="mx-auto grid w-full max-w-5xl gap-8 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl md:grid-cols-12 md:p-10">
        {/* Left Column: LGU Platform Branding & Sign-In Form */}
        <div className="flex flex-col justify-between md:col-span-6">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40">
                <Globe2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  LGeo: Web GIS-based System Using CBMS Data
                </h1>
                <p className="text-xs text-slate-400">
                  Municipality of San Jose, Province of Dinagat Islands
                </p>
              </div>
            </div>

            <h2 className="text-xl font-bold text-white">
              Sign in to LGU Spatial Portal
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Authorized access under RA 11315 (Community-Based Monitoring
              System Act) and RA 10173 (Data Privacy Act of 2012).
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Official LGU Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@sanjosedinagat.gov.ph"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500"
              >
                <span>Sign In to Web-GIS Portal</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="mt-8 border-t border-slate-800 pt-4 text-[11px] text-slate-500">
            ® 2026 All Rights Reserved, Lig-on Nga San Jose - Dinagat Islands
          </div>
        </div>

        {/* Right Column: Quick Role Session Cards for Capstone & RBAC Verification */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-5 md:col-span-6">
          <div>
            <h3 className="text-sm font-bold text-white">
              Quick LGU Role Sign-In (RBAC Profiles)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Select an LGU account below to immediately sign in with its role
              permissions and PII privacy clearance:
            </p>

            <div className="mt-4 space-y-2.5">
              {DEMO_LGU_ACCOUNTS.map((acc) => {
                const fullAccess = hasFullDataAccess(acc.role);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => loginAsRole(acc.role)}
                    className="group flex w-full items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-left transition hover:border-sky-500/50 hover:bg-slate-800/80"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-sky-300">
                          {acc.fullName}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            fullAccess
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {acc.role}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-300">
                        {acc.designation}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {acc.department}
                      </p>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      {fullAccess ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-amber-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-800/90 bg-slate-900/60 p-3 text-[11px] text-slate-400">
            <strong className="text-slate-200">Data Privacy Guardrail:</strong>{" "}
            Signing in as <span className="text-amber-300">STAFF</span> grants
            access to Barangay summaries and Household-level data (Sections F–O
            + Poverty & map points) while restricting individual Household
            Member data (Sections A–E).
          </div>
        </div>
      </div>
    </div>
  );
};
