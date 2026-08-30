import type { PermissionCode, RoleCode } from './rbac.constants';

export type AuthenticatedPrincipal = {
  sessionId: string;
  userId: string;
  phone: string;
  roleCodes: readonly RoleCode[];
  permissionCodes: readonly PermissionCode[];
};

export type RequestWithAuth = {
  headers?: {
    authorization?: string | string[];
  };
  auth?: AuthenticatedPrincipal;
};
