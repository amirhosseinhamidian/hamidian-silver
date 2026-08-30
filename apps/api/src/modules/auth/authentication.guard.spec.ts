import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedPrincipal, RequestWithAuth } from '../authorization/authorization.types';
import { ROLE_CODES } from '../authorization/rbac.constants';
import type { AuthService } from './auth.service';
import { AuthenticationGuard } from './authentication.guard';

describe('AuthenticationGuard', () => {
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

  it('allows public routes without authentication', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const authService = {
      authenticateAccessToken: jest.fn(),
    } as unknown as AuthService;
    const guard = new AuthenticationGuard(reflector, authService);

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
  });

  it('rejects protected routes without a bearer token', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const authService = {
      authenticateAccessToken: jest.fn(),
    } as unknown as AuthService;
    const guard = new AuthenticationGuard(reflector, authService);

    await expect(guard.canActivate(createContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the authenticated principal to the request', async () => {
    const principal: AuthenticatedPrincipal = {
      sessionId: '20000000-0000-4000-8000-000000000001',
      userId: '10000000-0000-4000-8000-000000000001',
      phone: '+989123456789',
      roleCodes: [ROLE_CODES.USER],
      permissionCodes: [],
    };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const authService = {
      authenticateAccessToken: jest.fn().mockResolvedValue(principal),
    } as unknown as AuthService;
    const guard = new AuthenticationGuard(reflector, authService);
    const request: RequestWithAuth = {
      headers: {
        authorization: `Bearer ${'a'.repeat(43)}`,
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.auth).toEqual(principal);
  });
});
