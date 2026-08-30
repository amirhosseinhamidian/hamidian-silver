import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from './rbac.constants';

export const PERMISSIONS_KEY = 'authorization:permissions';

export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
