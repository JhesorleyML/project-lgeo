import { z } from 'zod';

/**
 * Official LGU Roles aligned with users.role in 001_initial_cbms_schema.sql
 */
export const UserRoleSchema = z.enum([
  'ADMIN',
  'MUNICIPAL_STATISTICIAN',
  'MPDC',
  'STAFF',
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Roles with full access to unmasked PII (names, serials, exact GPS coordinates, beneficiary exports)
 */
export const FULL_ACCESS_ROLES: readonly UserRole[] = [
  'ADMIN',
  'MUNICIPAL_STATISTICIAN',
  'MPDC',
] as const;

export function hasFullDataAccess(role: UserRole): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}

/**
 * Household-level data access (households + Sections F–O + Poverty + Household MVT points):
 * Allowed for all authenticated LGU roles including STAFF.
 */
export function canAccessHouseholdData(role: UserRole): boolean {
  return FULL_ACCESS_ROLES.includes(role) || role === 'STAFF';
}

/**
 * Individual Household Member data access (household_members + Sections A–E member rosters & member PII):
 * Restricted to ADMIN, MUNICIPAL_STATISTICIAN, and MPDC. Blocked for STAFF.
 */
export function canAccessMemberData(role: UserRole): boolean {
  return hasFullDataAccess(role);
}

export function canUploadCbmsData(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'MUNICIPAL_STATISTICIAN';
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'ADMIN';
}

export type ReportTypeId = 'BARANGAY_SUMMARY' | 'HOUSEHOLD_ROSTER' | 'MEMBER_ROSTER';

/**
 * Tiered RBAC for CBMS Report Generation under RA 11315 & RA 10173:
 * - BARANGAY_SUMMARY (Aggregated statistical counts & percentages, zero PII): Allowed for ALL authenticated roles including STAFF.
 * - HOUSEHOLD_ROSTER (Household-level data across Sections F–O + Poverty): Allowed for ALL authenticated roles including STAFF (with member-level data restricted for STAFF).
 * - MEMBER_ROSTER (Individual member rosters across Sections A–E): Restricted to ADMIN, MUNICIPAL_STATISTICIAN, MPDC.
 */
export function canExportReportType(role: UserRole, reportType: ReportTypeId): boolean {
  if (reportType === 'BARANGAY_SUMMARY' || reportType === 'HOUSEHOLD_ROSTER') {
    return canAccessHouseholdData(role);
  }
  return canAccessMemberData(role);
}

