import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import {
  CreateCardToCardAccountDto,
  UpdateCardToCardAccountDto,
} from './dto/card-to-card-account.dto';

const ACCOUNT_SELECT = {
  id: true,
  cardNumber: true,
  holderName: true,
  bankName: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CardToCardAccountSelect;

@Injectable()
export class CardToCardAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicSettings() {
    const account = await this.prisma.cardToCardAccount.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: {
        cardNumber: true,
        holderName: true,
        bankName: true,
      },
    });

    return account
      ? { enabled: true, ...account }
      : { enabled: false, cardNumber: null, holderName: null, bankName: null };
  }

  listAccounts() {
    return this.prisma.cardToCardAccount.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: ACCOUNT_SELECT,
    });
  }

  async createAccount(dto: CreateCardToCardAccountDto, actorUserId: string) {
    const input = {
      cardNumber: dto.cardNumber,
      holderName: dto.holderName.trim(),
      bankName: dto.bankName.trim(),
    };
    this.assertNames(input.holderName, input.bankName);

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        if (dto.isActive) {
          await transaction.cardToCardAccount.updateMany({
            where: { isActive: true },
            data: { isActive: false, updatedByUserId: actorUserId },
          });
        }

        return transaction.cardToCardAccount.create({
          data: {
            ...input,
            isActive: dto.isActive ?? false,
            updatedByUserId: actorUserId,
          },
          select: ACCOUNT_SELECT,
        });
      });

      return attachHumanAuditEvent(created, {
        title: `حساب کارت‌به‌کارت بانک ${created.bankName} اضافه شد.`,
        operationType: 'CREATE',
        entityName: created.bankName,
        changes: [
          { field: 'bankName', label: 'بانک', before: null, after: created.bankName },
          { field: 'holderName', label: 'صاحب حساب', before: null, after: created.holderName },
          { field: 'isActive', label: 'وضعیت فعال', before: false, after: created.isActive },
        ],
      });
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async updateAccount(accountId: string, dto: UpdateCardToCardAccountDto, actorUserId: string) {
    const current = await this.prisma.cardToCardAccount.findUnique({
      where: { id: accountId },
      select: ACCOUNT_SELECT,
    });
    if (!current) throw new NotFoundException('Card-to-card account was not found.');

    const normalized = this.normalizeInput(dto);

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        if (dto.isActive === true) {
          await transaction.cardToCardAccount.updateMany({
            where: { id: { not: accountId }, isActive: true },
            data: { isActive: false, updatedByUserId: actorUserId },
          });
        }

        return transaction.cardToCardAccount.update({
          where: { id: accountId },
          data: {
            ...normalized,
            ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
            updatedByUserId: actorUserId,
          },
          select: ACCOUNT_SELECT,
        });
      });

      return attachHumanAuditEvent(updated, {
        title: `حساب کارت‌به‌کارت بانک ${updated.bankName} ویرایش شد.`,
        operationType: 'UPDATE',
        entityName: updated.bankName,
        changes: [
          ...(current.bankName === updated.bankName
            ? []
            : [
                {
                  field: 'bankName',
                  label: 'بانک',
                  before: current.bankName,
                  after: updated.bankName,
                },
              ]),
          ...(current.holderName === updated.holderName
            ? []
            : [
                {
                  field: 'holderName',
                  label: 'صاحب حساب',
                  before: current.holderName,
                  after: updated.holderName,
                },
              ]),
          ...(current.isActive === updated.isActive
            ? []
            : [
                {
                  field: 'isActive',
                  label: 'وضعیت فعال',
                  before: current.isActive,
                  after: updated.isActive,
                },
              ]),
        ],
      });
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async deleteAccount(accountId: string) {
    const current = await this.prisma.cardToCardAccount.findUnique({
      where: { id: accountId },
      select: ACCOUNT_SELECT,
    });
    if (!current) throw new NotFoundException('Card-to-card account was not found.');

    await this.prisma.cardToCardAccount.delete({ where: { id: accountId } });

    return attachHumanAuditEvent(
      { success: true, id: accountId },
      {
        title: `حساب کارت‌به‌کارت بانک ${current.bankName} حذف شد.`,
        operationType: 'DELETE',
        entityName: current.bankName,
        changes: [],
      },
    );
  }

  private normalizeInput(dto: UpdateCardToCardAccountDto) {
    const holderName = dto.holderName?.trim();
    const bankName = dto.bankName?.trim();
    this.assertNames(holderName, bankName);

    return {
      ...(dto.cardNumber === undefined ? {} : { cardNumber: dto.cardNumber }),
      ...(holderName === undefined ? {} : { holderName }),
      ...(bankName === undefined ? {} : { bankName }),
    };
  }

  private assertNames(holderName?: string, bankName?: string) {
    if (holderName !== undefined && holderName.length < 2) {
      throw new BadRequestException('Account holder name is invalid.');
    }
    if (bankName !== undefined && bankName.length < 2) {
      throw new BadRequestException('Bank name is invalid.');
    }
  }

  private rethrowConstraintError(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException(
        'This card number is already registered or another card is active.',
      );
    }
    throw error;
  }
}
