import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PERMISSION_CODES, ROLE_CODES } from '../authorization/rbac.constants';
import { AuthService } from './auth.service';
import type { OtpService } from './otp.service';

describe('AuthService', () => {
  const otpService = {
    requestCode: jest.fn(),
    verifyCode: jest.fn(),
  };

  const prisma = {
    authSession: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn().mockReturnValue(30),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as unknown as PrismaService,
      otpService as unknown as OtpService,
      configService as unknown as ConfigService,
    );
  });

  it('delegates OTP requests', async () => {
    const result = {
      challengeId: '10000000-0000-4000-8000-000000000001',
      expiresAt: new Date(),
    };
    otpService.requestCode.mockResolvedValue(result);

    await expect(service.requestOtp('09123456789')).resolves.toEqual(result);
    expect(otpService.requestCode).toHaveBeenCalledWith('09123456789');
  });

  it('creates a user session after successful OTP verification', async () => {
    otpService.verifyCode.mockResolvedValue({ phone: '+989123456789' });

    const transaction = {
      role: {
        findUnique: jest.fn().mockResolvedValue({
          id: '30000000-0000-4000-8000-000000000001',
          isActive: true,
          deletedAt: null,
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: '10000000-0000-4000-8000-000000000001',
          phone: '+989123456789',
        }),
      },
      userRole: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      authSession: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    );

    const result = await service.verifyOtp('09123456789', '123456');

    expect(result.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.user).toEqual({
      id: '10000000-0000-4000-8000-000000000001',
      phone: '+989123456789',
    });
    expect(transaction.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          userId: '10000000-0000-4000-8000-000000000001',
          roleId: '30000000-0000-4000-8000-000000000001',
        },
      }),
    );
    expect(transaction.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: '10000000-0000-4000-8000-000000000001',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    });
    expect(transaction.authSession.create.mock.calls[0][0].data.tokenHash).not.toBe(
      result.accessToken,
    );
  });

  it('rejects login for a disabled existing account', async () => {
    otpService.verifyCode.mockResolvedValue({ phone: '+989123456789' });

    const transaction = {
      role: {
        findUnique: jest.fn().mockResolvedValue({
          id: '30000000-0000-4000-8000-000000000001',
          isActive: true,
          deletedAt: null,
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: '10000000-0000-4000-8000-000000000001',
          isActive: false,
          deletedAt: null,
        }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    );

    await expect(service.verifyOtp('09123456789', '123456')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('builds an authenticated principal from a valid session', async () => {
    prisma.authSession.findUnique.mockResolvedValue({
      id: '20000000-0000-4000-8000-000000000001',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        id: '10000000-0000-4000-8000-000000000001',
        phone: '+989123456789',
        isActive: true,
        deletedAt: null,
        roles: [
          {
            role: {
              code: ROLE_CODES.ADMIN,
              permissions: [
                { permission: { code: PERMISSION_CODES.CATALOG_READ } },
                { permission: { code: PERMISSION_CODES.ORDERS_READ } },
              ],
            },
          },
        ],
      },
    });

    await expect(service.authenticateAccessToken('a'.repeat(43))).resolves.toEqual({
      sessionId: '20000000-0000-4000-8000-000000000001',
      userId: '10000000-0000-4000-8000-000000000001',
      phone: '+989123456789',
      roleCodes: [ROLE_CODES.ADMIN],
      permissionCodes: [PERMISSION_CODES.CATALOG_READ, PERMISSION_CODES.ORDERS_READ],
    });
  });

  it('rejects malformed or missing sessions', async () => {
    await expect(service.authenticateAccessToken('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    prisma.authSession.findUnique.mockResolvedValue(null);

    await expect(service.authenticateAccessToken('a'.repeat(43))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes the current session on logout', async () => {
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await service.logout('20000000-0000-4000-8000-000000000001');

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: '20000000-0000-4000-8000-000000000001',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });
});
