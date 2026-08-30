import type { PermissionCode, RoleCode } from './rbac.constants';

export type AuthenticatedPrincipal = {
  userId: string;
  roleCodes: readonly RoleCode[];
  permissionCodes: readonly PermissionCode[];
};

export type RequestWithAuth = {
  auth?: AuthenticatedPrincipal;
};
