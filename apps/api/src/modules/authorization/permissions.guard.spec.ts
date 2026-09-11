import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedPrincipal, RequestWithAuth } from './authorization.types';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';
import {
  PERMISSION_CODES,
  ROLE_CODES,
  SYSTEM_ROLE_PERMISSION_CODES,
  type PermissionCode,
  type RoleCode,
} from './rbac.constants';

describe('PermissionsGuard', () => {
  const handler = (): void => {};
  class TestController {}

  function createContext(request: RequestWithAuth): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () =>
        ({
          getRequest: () => request,
        }) as ReturnType<ExecutionContext['switchToHttp']>,
    } as ExecutionContext;
  }

  function createPrincipal(
    permissionCodes: AuthenticatedPrincipal['permissionCodes'],
    roleCode: RoleCode = ROLE_CODES.ADMIN,
  ): AuthenticatedPrincipal {
    return {
      sessionId: '20000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-0000-0000-000000000001',
      phone: '+989123456789',
      roleCodes: [roleCode],
      permissionCodes,
    };
  }

  it('allows routes without permission requirements', () => {
    const reflector = {
      getAllAndMerge: jest.fn().mockReturnValue([]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(createContext({}))).toBe(true);
  });

  it('allows an authenticated principal with every required permission', () => {
    const reflector = {
      getAllAndMerge: jest
        .fn()
        .mockReturnValue([PERMISSION_CODES.ORDERS_READ, PERMISSION_CODES.CATALOG_READ]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    const request: RequestWithAuth = {
      auth: createPrincipal([
        PERMISSION_CODES.ORDERS_READ,
        PERMISSION_CODES.CATALOG_READ,
        PERMISSION_CODES.INVENTORY_READ,
      ]),
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('throws UnauthorizedException when permission-protected route has no principal', () => {
    const reflector = {
      getAllAndMerge: jest.fn().mockReturnValue([PERMISSION_CODES.ORDERS_READ]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(createContext({}))).toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when any required permission is missing', () => {
    const reflector = {
      getAllAndMerge: jest
        .fn()
        .mockReturnValue([PERMISSION_CODES.ORDERS_READ, PERMISSION_CODES.FINANCE_READ]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    const request: RequestWithAuth = {
      auth: createPrincipal([PERMISSION_CODES.ORDERS_READ]),
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(ForbiddenException);
  });

  it('reads permission metadata from both handler and controller', () => {
    const reflector = {
      getAllAndMerge: jest.fn().mockReturnValue([PERMISSION_CODES.CMS_WRITE]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const context = createContext({
      auth: createPrincipal([PERMISSION_CODES.CMS_WRITE]),
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndMerge).toHaveBeenCalledWith(PERMISSIONS_KEY, [
      handler,
      TestController,
    ]);
  });

  describe.each(Object.values(ROLE_CODES))('%s role policy', (roleCode) => {
    const grantedPermissions = SYSTEM_ROLE_PERMISSION_CODES[roleCode];

    it.each(Object.values(PERMISSION_CODES))(
      'enforces %s according to the canonical role matrix',
      (permissionCode: PermissionCode) => {
        const reflector = {
          getAllAndMerge: jest.fn().mockReturnValue([permissionCode]),
        } as unknown as Reflector;
        const guard = new PermissionsGuard(reflector);
        const request: RequestWithAuth = {
          auth: createPrincipal([...grantedPermissions], roleCode),
        };

        if (grantedPermissions.includes(permissionCode)) {
          expect(guard.canActivate(createContext(request))).toBe(true);
        } else {
          expect(() => guard.canActivate(createContext(request))).toThrow(ForbiddenException);
        }
      },
    );
  });
});
