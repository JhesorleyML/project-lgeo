import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  canAccessMemberData,
  type AuthenticatedUser,
  type UserRole,
} from '@cbms/shared';
import { env } from '../config/env.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticateJwt(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
    } catch {
      // Fall through as unauthenticated / default STAFF preview in dev
    }
  }
  next();
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole: UserRole = req.user?.role ?? 'STAFF';
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Role '${userRole}' is not authorized for this resource. Required: ${allowedRoles.join(', ')}`,
      });
      return;
    }
    next();
  };
}

/**
 * Redacts member-level PII fields (Sections A-E member names/breakdown) when the user is STAFF,
 * while preserving household-level data (HUSN, HSN, address, coordinates, and Sections F-O + Poverty).
 * ADMIN, MUNICIPAL_STATISTICIAN, and MPDC retain full unmasked access to both household and member data.
 */
export function maskHouseholdPiiIfRestricted<T extends Record<string, unknown>>(
  record: T,
  role: UserRole = 'STAFF'
): T {
  if (canAccessMemberData(role)) {
    return record;
  }

  const redacted: Record<string, unknown> = { ...record };
  const memberPiiKeys = [
    'a01_last_name',
    'a01_first_name',
    'a01_middle_name',
    'a01_suffix',
    'headName',
    'head_name',
    'membersJson',
    'members_json',
  ];

  for (const key of memberPiiKeys) {
    if (key in redacted) {
      redacted[key] = '[REDACTED FOR STAFF ROLE]';
    }
  }

  return redacted as T;
}
