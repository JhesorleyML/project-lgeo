import { create } from "zustand";
import type { UserRole } from "@cbms/shared";
import { useMapFilterStore } from "./useMapFilterStore";

export interface LguUserAccount {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  designation: string;
  department: string;
}

export const DEMO_LGU_ACCOUNTS: readonly LguUserAccount[] = [
  {
    id: "usr-admin-01",
    fullName: "Administrator",
    email: "admin@sanjosedinagat.gov.ph",
    role: "ADMIN",
    designation: "System Administrator",
    department: "Office of the Municipal Planning and Development",
  },
  {
    id: "usr-stat-02",
    fullName: "Doncie M. Paquibot, LPT",
    email: "statistician@sanjosedinagat.gov.ph",
    role: "MUNICIPAL_STATISTICIAN",
    designation: "Statistician I",
    department: "Municipal Planning and Development Office",
  },
  {
    id: "usr-mpdc-03",
    fullName: "Engr Froilyn T. Fuentes, EnP",
    email: "mpdc@sanjosedinagat.gov.ph",
    role: "MPDC",
    designation: "Municipal Planning & Development Coordinator",
    department: "MPDO — Comprehensive Land Use & Socio-Economic Planning",
  },
  {
    id: "usr-staff-04",
    fullName: "San Jose LGU-Staff",
    email: "staff@sanjosedinagat.gov.ph",
    role: "STAFF",
    designation: "MPDO-Staff",
    department: "MPDO",
  },
] as const;

interface AuthState {
  currentUser: LguUserAccount | null;
  loginAsRole: (role: UserRole) => void;
  loginWithEmail: (email: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Default logged in as Municipal Admin so existing session loads seamlessly; Logout takes user to LoginPage
  currentUser: DEMO_LGU_ACCOUNTS[0]!,
  loginAsRole: (role) => {
    const account =
      DEMO_LGU_ACCOUNTS.find((a) => a.role === role) ?? DEMO_LGU_ACCOUNTS[0]!;
    useMapFilterStore.getState().setActiveRole(account.role);
    set({ currentUser: account });
  },
  loginWithEmail: (email) => {
    const clean = email.trim().toLowerCase();
    const matched =
      DEMO_LGU_ACCOUNTS.find((a) => a.email.toLowerCase() === clean) ??
      (clean.includes("stat")
        ? DEMO_LGU_ACCOUNTS[1]
        : clean.includes("mpdc")
          ? DEMO_LGU_ACCOUNTS[2]
          : clean.includes("staff")
            ? DEMO_LGU_ACCOUNTS[3]
            : DEMO_LGU_ACCOUNTS[0]);
    if (!matched) return false;
    useMapFilterStore.getState().setActiveRole(matched.role);
    set({ currentUser: matched });
    return true;
  },
  logout: () => {
    set({ currentUser: null });
  },
}));
