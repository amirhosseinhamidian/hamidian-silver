import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ROLE_CODES, type RoleCode } from '../authorization/rbac.constants';
import type { UpdateAdminMessageRecipientDto } from './dto/update-admin-message-recipient.dto';

const RECIPIENT_ROLES = [ROLE_CODES.MANAGER, ROLE_CODES.ADMIN] as const;

@Injectable()
export class AdminMessageRecipientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(actorRoles: readonly RoleCode[]) {
    this.ensureManager(actorRoles);
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        roles: {
          some: {
            role: {
              code: { in: [...RECIPIENT_ROLES] },
              isActive: true,
              deletedAt: null,
            },
          },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { phone: 'asc' }],
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        roles: {
          where: { role: { code: { in: [...RECIPIENT_ROLES] }, isActive: true, deletedAt: null } },
          select: { role: { select: { code: true } } },
        },
        adminMessageRecipient: {
          select: { telegramChatId: true, baleChatId: true },
        },
      },
    });

    return {
      telegramConfigured: Boolean(this.config.get<string>('TELEGRAM_BOT_TOKEN')?.trim()),
      baleConfigured: Boolean(this.config.get<string>('BALE_BOT_TOKEN')?.trim()),
      recipients: users.map((user) => ({
        userId: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles.map(({ role }) => role.code),
        telegramChatId: user.adminMessageRecipient?.telegramChatId ?? null,
        baleChatId: user.adminMessageRecipient?.baleChatId ?? null,
      })),
    };
  }

  async update(
    userId: string,
    actorUserId: string,
    actorRoles: readonly RoleCode[],
    dto: UpdateAdminMessageRecipientDto,
  ) {
    this.ensureManager(actorRoles);
    const target = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        deletedAt: null,
        roles: {
          some: {
            role: {
              code: { in: [...RECIPIENT_ROLES] },
              isActive: true,
              deletedAt: null,
            },
          },
        },
      },
      select: { id: true, adminMessageRecipient: true },
    });
    if (!target) throw new NotFoundException('Active admin or manager was not found.');

    const telegramChatId =
      dto.telegramChatId === undefined
        ? (target.adminMessageRecipient?.telegramChatId ?? null)
        : dto.telegramChatId;
    const baleChatId =
      dto.baleChatId === undefined
        ? (target.adminMessageRecipient?.baleChatId ?? null)
        : dto.baleChatId;

    try {
      if (!telegramChatId && !baleChatId) {
        await this.prisma.adminMessageRecipient.deleteMany({ where: { userId } });
      } else {
        await this.prisma.adminMessageRecipient.upsert({
          where: { userId },
          create: { userId, telegramChatId, baleChatId, updatedByUserId: actorUserId },
          update: { telegramChatId, baleChatId, updatedByUserId: actorUserId },
        });
      }
    } catch (error) {
      if (this.prismaErrorCode(error) === 'P2002') {
        throw new ConflictException('This chat ID is already assigned to another user.');
      }
      throw error;
    }

    return this.list(actorRoles);
  }

  private ensureManager(actorRoles: readonly RoleCode[]): void {
    if (!actorRoles.includes(ROLE_CODES.MANAGER)) {
      throw new ForbiddenException('Only a manager can manage order notification recipients.');
    }
  }

  private prismaErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
    return typeof error.code === 'string' ? error.code : undefined;
  }
}
