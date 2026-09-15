import type { components } from '@hamidian/contracts';

export type AdminCurrentUser = components['schemas']['CurrentUserResponseDto'];
export type AdminPermission = AdminCurrentUser['permissions'][number];
export type AdminRole = AdminCurrentUser['roles'][number];
export type AdminAccessDecision = 'granted' | 'unauthenticated' | 'forbidden';

const ADMINISTRATIVE_ROLES: ReadonlySet<AdminRole> = new Set(['ADMIN', 'MANAGER']);

export function hasAdministrativeAccess(user: AdminCurrentUser): boolean {
  return user.roles.some((role) => ADMINISTRATIVE_ROLES.has(role));
}

export function hasAllAdminPermissions(
  user: AdminCurrentUser,
  requiredPermissions: readonly AdminPermission[],
): boolean {
  const granted = new Set(user.permissions);
  return requiredPermissions.every((permission) => granted.has(permission));
}

export function hasAnyAdminPermission(
  user: AdminCurrentUser,
  candidatePermissions: readonly AdminPermission[],
): boolean {
  const granted = new Set(user.permissions);
  return candidatePermissions.some((permission) => granted.has(permission));
}

export function evaluateAdminAccess(
  user: AdminCurrentUser | null,
  requiredPermissions: readonly AdminPermission[] = [],
): AdminAccessDecision {
  if (!user) return 'unauthenticated';
  if (!hasAdministrativeAccess(user)) return 'forbidden';
  return hasAllAdminPermissions(user, requiredPermissions) ? 'granted' : 'forbidden';
}
