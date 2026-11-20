import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, ShieldCheck, ShieldAlert, UserCheck } from 'lucide-react';
import { hasFullDataAccess } from '@cbms/shared';
import { DEMO_LGU_ACCOUNTS, useAuthStore } from '../../store/useAuthStore';

export const UserProfileMenu: React.FC = () => {
  const { currentUser, loginAsRole, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (evt: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(evt.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!currentUser) return null;

  const fullAccess = hasFullDataAccess(currentUser.role);
  const initials = currentUser.fullName
    .split(' ')
    .filter((p) => p.length > 1 && !p.endsWith('.'))
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2.5 rounded-lg border border-slate-700/80 bg-slate-800/90 px-2.5 py-1.5 text-left transition hover:border-slate-600 hover:bg-slate-800"
      >
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            fullAccess
              ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
              : 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
          }`}
        >
          {initials || 'LG'}
        </div>
        <div className="hidden sm:block">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-100">
              {currentUser.fullName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span
              className={`font-semibold ${
                fullAccess ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {currentUser.role}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">
              {fullAccess ? 'Full Data Access' : 'HH Access • Member Restricted'}
            </span>
          </div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md">
          {/* User Identity Card */}
          <div className="border-b border-slate-800 pb-3">
            <p className="text-sm font-bold text-white">{currentUser.fullName}</p>
            <p className="text-xs text-sky-400">{currentUser.designation}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {currentUser.department}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              {currentUser.email}
            </p>

            <div
              className={`mt-2.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                fullAccess
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              {fullAccess ? (
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              )}
              <span>
                {fullAccess
                  ? 'RA 10173 Authorized: Full Household & Member Data (Sections A–O)'
                  : 'RA 10173 Tiered: Household-Level Data Enabled • Member Data (Sections A–E) Restricted'}
              </span>
            </div>
          </div>

          {/* Quick Demo Account Switcher */}
          <div className="border-b border-slate-800 py-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <UserCheck className="h-3.5 w-3.5 text-sky-400" />
              Switch LGU Role Session
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_LGU_ACCOUNTS.map((acc) => {
                const isCurrent = acc.role === currentUser.role;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      loginAsRole(acc.role);
                      setOpen(false);
                    }}
                    className={`rounded-md border px-2 py-1.5 text-left text-[10px] transition ${
                      isCurrent
                        ? 'border-sky-500/60 bg-sky-500/20 font-semibold text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <div className="truncate font-semibold">{acc.role}</div>
                    <div className="truncate text-[9px] text-slate-400">
                      {acc.fullName}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="pt-2.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out of LGU Portal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
