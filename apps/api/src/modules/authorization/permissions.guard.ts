import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithAuth } from './authorization.types';
import { PERMISSIONS_KEY } from './permissions.decorator';
import type { PermissionCode } from './rbac.constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndMerge<PermissionCode[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const principal = request.auth;

    if (!principal) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const grantedPermissions = new Set(principal.permissionCodes);
    const missingPermissions = requiredPermissions.filter(
      (permission) => !grantedPermissions.has(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException('Required permission is missing.');
    }

    return true;
  }
}
