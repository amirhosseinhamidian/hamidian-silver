import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { ROLE_CODES } from '../authorization/rbac.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('requests an OTP challenge', async () => {
    const result = {
      challengeId: '10000000-0000-4000-8000-000000000001',
      expiresAt: new Date('2026-08-30T12:00:00.000Z'),
    };

    authService.requestOtp.mockResolvedValue(result);

    await expect(controller.requestCode({ phone: '09123456789' })).resolves.toEqual(result);
    expect(authService.requestOtp).toHaveBeenCalledWith('09123456789');
  });

  it('verifies OTP and returns a session', async () => {
    const result = {
      accessToken: 'a'.repeat(43),
      tokenType: 'Bearer',
      expiresAt: new Date('2026-09-29T12:00:00.000Z'),
      user: {
        id: '10000000-0000-4000-8000-000000000001',
        phone: '+989123456789',
      },
    };

    authService.verifyOtp.mockResolvedValue(result);

    await expect(
      controller.verifyCode({
        phone: '09123456789',
        code: '123456',
      }),
    ).resolves.toEqual(result);

    expect(authService.verifyOtp).toHaveBeenCalledWith('09123456789', '123456');
  });

  it('returns the current authenticated principal', () => {
    const principal: AuthenticatedPrincipal = {
      sessionId: '20000000-0000-4000-8000-000000000001',
      userId: '10000000-0000-4000-8000-000000000001',
      phone: '+989123456789',
      roleCodes: [ROLE_CODES.USER],
      permissionCodes: [],
    };
    const result = {
      id: principal.userId,
      phone: principal.phone,
      roles: principal.roleCodes,
      permissions: principal.permissionCodes,
    };

    authService.getCurrentUser.mockReturnValue(result);

    expect(controller.getCurrentUser(principal)).toEqual(result);
    expect(authService.getCurrentUser).toHaveBeenCalledWith(principal);
  });

  it('logs out the current session', async () => {
    const principal: AuthenticatedPrincipal = {
      sessionId: '20000000-0000-4000-8000-000000000001',
      userId: '10000000-0000-4000-8000-000000000001',
      phone: '+989123456789',
      roleCodes: [ROLE_CODES.USER],
      permissionCodes: [],
    };
    authService.logout.mockResolvedValue(undefined);

    await expect(controller.logout(principal)).resolves.toBeUndefined();
    expect(authService.logout).toHaveBeenCalledWith(principal.sessionId);
  });

  it('logs out every session for the current user', async () => {
    const principal: AuthenticatedPrincipal = {
      sessionId: '20000000-0000-4000-8000-000000000001',
      userId: '10000000-0000-4000-8000-000000000001',
      phone: '+989123456789',
      roleCodes: [ROLE_CODES.USER],
      permissionCodes: [],
    };
    authService.logoutAll.mockResolvedValue(undefined);

    await expect(controller.logoutAll(principal)).resolves.toBeUndefined();
    expect(authService.logoutAll).toHaveBeenCalledWith(principal.userId);
  });
});
