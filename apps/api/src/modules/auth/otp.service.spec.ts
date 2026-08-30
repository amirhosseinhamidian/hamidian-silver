import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { OtpCodeGenerator } from './otp-code-generator';
import { OtpService } from './otp.service';
import type { SmsSender } from './sms-sender.port';

describe('OtpService', () => {
  const pepper = 'test-otp-pepper-that-is-at-least-thirty-two-characters';
  const code = '123456';

  const prisma = {
    otpChallenge: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const codeGenerator = {
    generate: jest.fn().mockReturnValue(code),
  };

  const smsSender = {
    sendOtp: jest.fn(),
  };

  const configService = {
    getOrThrow: jest.fn().mockReturnValue(pepper),
  };

  let service: OtpService;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.$transaction.mockImplementation(
      async (
        callback: (transaction: {
          otpChallenge: {
            updateMany: jest.Mock;
            create: jest.Mock;
          };
        }) => Promise<void>,
      ) => {
        await callback({
          otpChallenge: {
            updateMany: jest.fn(),
            create: jest.fn(),
          },
        });
      },
    );

    service = new OtpService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      codeGenerator as unknown as OtpCodeGenerator,
      smsSender as SmsSender,
    );
  });

  it('creates and sends an OTP challenge without returning the code', async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue(null);
    smsSender.sendOtp.mockResolvedValue(undefined);

    const result = await service.requestCode('09123456789');

    expect(result.challengeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result).not.toHaveProperty('code');
    expect(smsSender.sendOtp).toHaveBeenCalledWith({
      phone: '+989123456789',
      code,
    });
  });

  it('rate limits repeated OTP requests during the cooldown', async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue({
      id: 'existing-challenge',
    });

    await expect(service.requestCode('09123456789')).rejects.toBeInstanceOf(HttpException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(smsSender.sendOtp).not.toHaveBeenCalled();
  });

  it('invalidates the challenge when sending the SMS fails', async () => {
    prisma.otpChallenge.findFirst.mockResolvedValue(null);
    smsSender.sendOtp.mockRejectedValue(new Error('SMS unavailable'));
    prisma.otpChallenge.update.mockResolvedValue({});

    await expect(service.requestCode('09123456789')).rejects.toThrow('SMS unavailable');
    expect(prisma.otpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invalidatedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('consumes a valid OTP', async () => {
    const id = '10000000-0000-4000-8000-000000000001';

    prisma.otpChallenge.findFirst.mockResolvedValue({
      id,
      phone: '+989123456789',
      purpose: 'AUTHENTICATION',
      codeHash: createCodeHash(id, code, pepper),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      maxAttempts: 5,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.otpChallenge.update.mockResolvedValue({});

    await expect(service.verifyCode('09123456789', code)).resolves.toEqual({
      phone: '+989123456789',
    });

    expect(prisma.otpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id },
        data: {
          consumedAt: expect.any(Date),
        },
      }),
    );
  });

  it('increments attempts for an invalid OTP', async () => {
    const id = '10000000-0000-4000-8000-000000000001';

    prisma.otpChallenge.findFirst.mockResolvedValue({
      id,
      phone: '+989123456789',
      purpose: 'AUTHENTICATION',
      codeHash: createCodeHash(id, code, pepper),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 1,
      maxAttempts: 5,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.otpChallenge.update.mockResolvedValue({});

    await expect(service.verifyCode('09123456789', '654321')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(prisma.otpChallenge.update).toHaveBeenCalledWith({
      where: { id },
      data: {
        attempts: 2,
        invalidatedAt: undefined,
      },
    });
  });

  it('invalidates an expired OTP', async () => {
    const id = '10000000-0000-4000-8000-000000000001';

    prisma.otpChallenge.findFirst.mockResolvedValue({
      id,
      phone: '+989123456789',
      purpose: 'AUTHENTICATION',
      codeHash: createCodeHash(id, code, pepper),
      expiresAt: new Date(Date.now() - 1_000),
      attempts: 0,
      maxAttempts: 5,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.otpChallenge.update.mockResolvedValue({});

    await expect(service.verifyCode('09123456789', code)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(prisma.otpChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id },
        data: {
          invalidatedAt: expect.any(Date),
        },
      }),
    );
  });
});

function createCodeHash(challengeId: string, code: string, pepper: string): string {
  return createHmac('sha256', pepper).update(`${challengeId}:${code}`).digest('hex');
}
