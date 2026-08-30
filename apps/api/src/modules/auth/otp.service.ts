import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OtpCodeGenerator } from './otp-code-generator';
import { normalizeIranianMobile } from './phone-normalizer';
import { SMS_SENDER, type SmsSender } from './sms-sender.port';

const OTP_PURPOSE = 'AUTHENTICATION' as const;
const OTP_TTL_MS = 2 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const INVALID_CODE_MESSAGE = 'Invalid or expired verification code.';

type OtpRequestResult = {
  challengeId: string;
  expiresAt: Date;
};

type OtpVerificationResult = {
  phone: string;
};

@Injectable()
export class OtpService {
  private readonly pepper: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
    private readonly codeGenerator: OtpCodeGenerator,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
  ) {
    this.pepper = configService.getOrThrow<string>('OTP_PEPPER');
  }

  async requestCode(rawPhone: string): Promise<OtpRequestResult> {
    const phone = normalizeIranianMobile(rawPhone);
    const now = new Date();
    const cooldownStartedAt = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS);

    const recentChallenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: OTP_PURPOSE,
        invalidatedAt: null,
        createdAt: {
          gte: cooldownStartedAt,
        },
      },
      select: {
        id: true,
      },
    });

    if (recentChallenge) {
      throw new HttpException(
        'Please wait before requesting another verification code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const challengeId = randomUUID();
    const code = this.codeGenerator.generate();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const codeHash = this.hashCode(challengeId, code);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.otpChallenge.updateMany({
        where: {
          phone,
          purpose: OTP_PURPOSE,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: {
          invalidatedAt: now,
        },
      });

      await transaction.otpChallenge.create({
        data: {
          id: challengeId,
          phone,
          purpose: OTP_PURPOSE,
          codeHash,
          expiresAt,
          maxAttempts: OTP_MAX_ATTEMPTS,
        },
      });
    });

    try {
      await this.smsSender.sendOtp({
        phone,
        code,
      });
    } catch (error: unknown) {
      await this.prisma.otpChallenge.update({
        where: {
          id: challengeId,
        },
        data: {
          invalidatedAt: new Date(),
        },
      });

      throw error;
    }

    return {
      challengeId,
      expiresAt,
    };
  }

  async verifyCode(rawPhone: string, code: string): Promise<OtpVerificationResult> {
    const phone = normalizeIranianMobile(rawPhone);

    if (!/^\d{6}$/.test(code)) {
      throw new UnauthorizedException(INVALID_CODE_MESSAGE);
    }

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phone,
        purpose: OTP_PURPOSE,
        consumedAt: null,
        invalidatedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!challenge) {
      throw new UnauthorizedException(INVALID_CODE_MESSAGE);
    }

    const now = new Date();

    if (challenge.expiresAt <= now || challenge.attempts >= challenge.maxAttempts) {
      await this.prisma.otpChallenge.update({
        where: {
          id: challenge.id,
        },
        data: {
          invalidatedAt: now,
        },
      });

      throw new UnauthorizedException(INVALID_CODE_MESSAGE);
    }

    if (!this.matchesCode(challenge.id, code, challenge.codeHash)) {
      const attempts = challenge.attempts + 1;

      await this.prisma.otpChallenge.update({
        where: {
          id: challenge.id,
        },
        data: {
          attempts,
          invalidatedAt: attempts >= challenge.maxAttempts ? now : undefined,
        },
      });

      throw new UnauthorizedException(INVALID_CODE_MESSAGE);
    }

    await this.prisma.otpChallenge.update({
      where: {
        id: challenge.id,
      },
      data: {
        consumedAt: now,
      },
    });

    return {
      phone,
    };
  }

  private hashCode(challengeId: string, code: string): string {
    return createHmac('sha256', this.pepper).update(`${challengeId}:${code}`).digest('hex');
  }

  private matchesCode(challengeId: string, code: string, storedHash: string): boolean {
    const candidate = Buffer.from(this.hashCode(challengeId, code), 'hex');
    const expected = Buffer.from(storedHash, 'hex');

    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }
}
