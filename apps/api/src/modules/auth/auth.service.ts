import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types';
import { isPermissionCode, isRoleCode, ROLE_CODES } from '../authorization/rbac.constants';
import { OtpService } from './otp.service';

const INVALID_SESSION_MESSAGE = 'Invalid or expired session.';

type LoginResult = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: Date;
  user: {
    id: string;
    phone: string;
  };
};

@Injectable()
export class AuthService {
  private readonly sessionTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    configService: ConfigService,
  ) {
    const sessionTtlDays = configService.getOrThrow<number>('AUTH_SESSION_TTL_DAYS');
    this.sessionTtlMs = sessionTtlDays * 24 * 60 * 60 * 1000;
  }

  requestOtp(phone: string) {
    return this.otpService.requestCode(phone);
  }

  async verifyOtp(phone: string, code: string): Promise<LoginResult> {
    const verification = await this.otpService.verifyCode(phone, code);

    return this.createSession(verification.phone);
  }

  async authenticateAccessToken(accessToken: string): Promise<AuthenticatedPrincipal> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(accessToken)) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const session = await this.prisma.authSession.findUnique({
      where: {
        tokenHash: this.hashToken(accessToken),
      },
      include: {
        user: {
          include: {
            roles: {
              where: {
                role: {
                  is: {
                    isActive: true,
                    deletedAt: null,
                  },
                },
              },
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const now = new Date();

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !session.user.isActive ||
      session.user.deletedAt
    ) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const roleCodes = [
      ...new Set(session.user.roles.map(({ role }) => role.code).filter(isRoleCode)),
    ];
    const permissionCodes = [
      ...new Set(
        session.user.roles
          .flatMap(({ role }) => role.permissions.map(({ permission }) => permission.code))
          .filter(isPermissionCode),
      ),
    ];

    return {
      sessionId: session.id,
      userId: session.user.id,
      phone: session.user.phone,
      roleCodes,
      permissionCodes,
    };
  }

  getCurrentUser(principal: AuthenticatedPrincipal) {
    return {
      id: principal.userId,
      phone: principal.phone,
      roles: principal.roleCodes,
      permissions: principal.permissionCodes,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private async createSession(phone: string): Promise<LoginResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlMs);
    const accessToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(accessToken);

    const result = await this.prisma.$transaction(async (transaction) => {
      const defaultRole = await transaction.role.findUnique({
        where: {
          code: ROLE_CODES.USER,
        },
        select: {
          id: true,
          isActive: true,
          deletedAt: true,
        },
      });

      if (!defaultRole || !defaultRole.isActive || defaultRole.deletedAt) {
        throw new InternalServerErrorException('System roles are not initialized.');
      }

      const existingUser = await transaction.user.findUnique({
        where: { phone },
        select: {
          id: true,
          isActive: true,
          deletedAt: true,
        },
      });

      if (existingUser && (!existingUser.isActive || existingUser.deletedAt)) {
        throw new ForbiddenException('Account is unavailable.');
      }

      const user = await transaction.user.upsert({
        where: { phone },
        update: {
          phoneVerifiedAt: now,
          lastLoginAt: now,
        },
        create: {
          phone,
          phoneVerifiedAt: now,
          lastLoginAt: now,
        },
        select: {
          id: true,
          phone: true,
        },
      });

      await transaction.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: defaultRole.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: defaultRole.id,
        },
      });

      await transaction.authSession.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      return user;
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresAt,
      user: result,
    };
  }

  private hashToken(accessToken: string): string {
    return createHash('sha256').update(accessToken).digest('hex');
  }
}
