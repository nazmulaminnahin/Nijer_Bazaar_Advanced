import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { admins } from '../schemas/index';
import { AppError } from './errorHandler';
import { verifyAdminToken } from '../utils/jwt';
import { can, permissionsForRole, type Permission } from '../config/permissions';

export interface AdminAuthRequest extends Request {
  adminId?: number;
  adminEmail?: string;
  adminRole?: string;
  adminName?: string;
  adminPermissions?: string[];
}

export type AdminRequest = AdminAuthRequest;

/**
 * Verifies the admin JWT **and** re-checks the account in the database so that
 * deactivating or demoting a staff member takes effect immediately.
 */
export async function authenticateAdmin(req: AdminAuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Admin authentication required. Please log in.', 401));
  }
  try {
    const decoded = verifyAdminToken(header.slice(7));
    const [account] = await db.select().from(admins).where(eq(admins.id, decoded.adminId)).limit(1);
    if (!account || !account.isActive) {
      return next(new AppError('This account is inactive. Contact an administrator.', 403));
    }
    req.adminId = account.id;
    req.adminEmail = account.email ?? undefined;
    req.adminName = account.name;
    req.adminRole = account.role;
    req.adminPermissions = permissionsForRole(account.role, account.permissions ?? []);
    return next();
  } catch {
    return next(new AppError('Invalid or expired admin session. Please log in again.', 401));
  }
}

/** Legacy role guard (kept for compatibility). super_admin/admin always pass. */
export function requireRole(...roles: string[]) {
  return (req: AdminAuthRequest, _res: Response, next: NextFunction) => {
    const role = req.adminRole;
    if (!role) return next(new AppError('Admin authentication required.', 401));
    if (role === 'super_admin' || role === 'admin' || roles.includes(role)) return next();
    return next(new AppError('You do not have permission to perform this action.', 403));
  };
}

/** Fine-grained permission guard used by newer routes. */
export function requirePermission(...permissions: Permission[]) {
  return (req: AdminAuthRequest, _res: Response, next: NextFunction) => {
    const role = req.adminRole ?? '';
    const extra = req.adminPermissions ?? [];
    const allowed = permissions.every((p) => can(role, extra, p));
    if (!allowed) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    return next();
  };
}

/** Attaches admin identity when a valid token is present, without rejecting. */
export async function optionalAdminAuth(req: AdminAuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = verifyAdminToken(header.slice(7));
      const [account] = await db.select().from(admins).where(eq(admins.id, decoded.adminId)).limit(1);
      if (account?.isActive) {
        req.adminId = account.id;
        req.adminRole = account.role;
        req.adminPermissions = permissionsForRole(account.role, account.permissions ?? []);
      }
    } catch {
      /* anonymous request */
    }
  }
  return next();
}
