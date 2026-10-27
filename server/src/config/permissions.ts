/**
 * Role-based permission matrix.
 * Permissions are `module:action`. `super_admin` always has everything.
 * Enforced server-side by middleware/adminAuth.requirePermission().
 */
export const ADMIN_ROLES = ['super_admin', 'manager', 'staff', 'support'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ALL_PERMISSIONS = [
  'dashboard:read',
  'orders:read',
  'orders:write',
  'orders:delete',
  'products:read',
  'products:write',
  'categories:read',
  'categories:write',
  'inventory:read',
  'inventory:write',
  'customers:read',
  'customers:write',
  'promotions:read',
  'promotions:write',
  'giftcards:read',
  'giftcards:write',
  'coupons:read',
  'coupons:write',
  'flashsales:read',
  'flashsales:write',
  'reports:read',
  'accounting:read',
  'accounting:write',
  'staff:read',
  'staff:write',
  'staff:salary',
  'settings:read',
  'settings:write',
  'notifications:read',
  'notifications:write',
  'couriers:read',
  'couriers:write',
] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  manager: [
    'dashboard:read', 'orders:read', 'orders:write', 'products:read', 'products:write',
    'categories:read', 'categories:write', 'inventory:read', 'inventory:write',
    'customers:read', 'customers:write', 'promotions:read', 'promotions:write',
    'giftcards:read', 'giftcards:write', 'coupons:read', 'coupons:write',
    'flashsales:read', 'flashsales:write', 'reports:read', 'accounting:read',
    'staff:read', 'settings:read', 'notifications:read', 'notifications:write',
    'couriers:read', 'couriers:write',
  ],
  staff: [
    'dashboard:read', 'orders:read', 'orders:write', 'products:read', 'products:write',
    'categories:read', 'inventory:read', 'inventory:write', 'customers:read',
    'coupons:read', 'giftcards:read', 'promotions:read', 'notifications:read',
    'couriers:read', 'reports:read',
  ],
  support: ['dashboard:read', 'orders:read', 'customers:read', 'products:read', 'coupons:read', 'notifications:read'],
};

export function permissionsForRole(role: string, extra: string[] = []): string[] {
  const base = ROLE_PERMISSIONS[role as AdminRole] ?? ROLE_PERMISSIONS.staff;
  const normalizedExtras = extra.filter((p): p is Permission => (ALL_PERMISSIONS as readonly string[]).includes(p));
  return Array.from(new Set([...base, ...normalizedExtras]));
}

export function can(role: string, extra: string[], permission: Permission): boolean {
  if (role === 'super_admin' || role === 'admin') return true;
  return permissionsForRole(role, extra).includes(permission);
}
