import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma, WalletNotificationSettings } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { normalizeIranianMobile } from '../auth/phone-normalizer';
import type { SendSmsMessage } from '../auth/sms-sender.port';
import { spendableWalletLots } from '../wallet/wallet-ledger';
import type {
  UpdateWalletNotificationSettingsDto,
  WalletCustomerNotificationsDto,
  WalletNotificationPreferencesDto,
  WalletNotificationSettingsDto,
} from './dto/wallet-credit-notification.dto';

const dayMs = 86_400_000;
const minuteMs = 60_000;
const activationTemplateVersion = 'wallet-activation-v1';
const number = new Intl.NumberFormat('fa-IR');
const date = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function activationText(amountToman: number, expiresAt: Date) {
  return `گالری حمیدیان\nاعتبار ${number.format(amountToman)} تومان فعال شد.\nتاریخ انقضا ${date.format(expiresAt)}.`;
}

function settingsDto(settings: WalletNotificationSettings): WalletNotificationSettingsDto {
  return {
    version: settings.version,
    activationSmsEnabled:
      settings.activationSmsEnabled &&
      settings.activationTemplateVersion === activationTemplateVersion,
    activationIntervalMinutes: settings.activationIntervalMinutes,
    expiryInAppEnabled: settings.expiryInAppEnabled,
    expiryNoticeDays: settings.expiryNoticeDays,
    expiryUrgentDays: settings.expiryUrgentDays,
    activationSmsPreview: activationText(250_000, new Date('2027-03-21T12:00:00Z')),
  };
}

async function databaseNow(tx: Prisma.TransactionClient) {
  const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`
    SELECT clock_timestamp()::timestamptz(3) AS now
  `;
  return now;
}

async function lockWalletSms(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('wallet-sms:' || ${userId}::uuid::text, 0))`;
}

export async function enqueueWalletCreditActivation(
  tx: Prisma.TransactionClient,
  userId: string,
  lot: { id: string; pendingToman: number; revokedToman: number; expiresAt: Date },
  activatedAt: Date,
) {
  const settings = await tx.walletNotificationSettings.findUnique({
    where: { id: 1 },
    select: { activationConsentKey: true, activationTemplateVersion: true },
  });
  if (
    !settings?.activationConsentKey ||
    settings.activationTemplateVersion !== activationTemplateVersion
  )
    return;
  const preference = await tx.walletNotificationPreference.findUnique({
    where: { userId },
    select: { activationConsentKey: true },
  });
  if (!preference?.activationConsentKey) return;
  await tx.notificationOutboxEvent.createMany({
    data: {
      type: 'WALLET_CREDIT_ACTIVATED',
      aggregateType: 'WALLET_LOT',
      aggregateId: lot.id,
      deduplicationKey: `wallet-credit:activated:${lot.id}`,
      payload: {
        amountToman: lot.pendingToman,
        revokedToman: lot.revokedToman,
        expiresAt: lot.expiresAt.toISOString(),
        templateVersion: activationTemplateVersion,
        settingsConsentKey: settings.activationConsentKey,
        customerConsentKey: preference.activationConsentKey,
      },
      createdAt: activatedAt,
      nextAttemptAt: activatedAt,
    },
    skipDuplicates: true,
  });
}

@Injectable()
export class WalletCreditNotificationsService {
  constructor(private readonly db: PrismaService) {}

  async settings(): Promise<WalletNotificationSettingsDto> {
    return settingsDto(
      await this.db.walletNotificationSettings.findUniqueOrThrow({ where: { id: 1 } }),
    );
  }

  async updateSettings({ expectedVersion, ...changes }: UpdateWalletNotificationSettingsDto) {
    if (changes.expiryUrgentDays > changes.expiryNoticeDays) {
      throw new BadRequestException('بازهٔ هشدار فوری باید در بازهٔ یادآوری انقضا باشد.');
    }
    return this.db.$transaction(async (tx) => {
      const current = await tx.walletNotificationSettings.findUniqueOrThrow({ where: { id: 1 } });
      const result = await tx.walletNotificationSettings.updateMany({
        where: { id: 1, version: expectedVersion },
        data: {
          ...changes,
          version: { increment: 1 },
          activationConsentKey: changes.activationSmsEnabled
            ? ((current.activationTemplateVersion === activationTemplateVersion
                ? current.activationConsentKey
                : null) ?? randomUUID())
            : null,
          activationTemplateVersion: changes.activationSmsEnabled
            ? activationTemplateVersion
            : null,
        },
      });
      if (!result.count)
        throw new ConflictException('تنظیمات تغییر کرده‌اند. صفحه را دوباره بارگذاری کنید.');
      return {
        before: settingsDto(current),
        after: settingsDto(
          await tx.walletNotificationSettings.findUniqueOrThrow({ where: { id: 1 } }),
        ),
      };
    });
  }

  async updatePreferences(userId: string, input: WalletNotificationPreferencesDto) {
    await this.db.$transaction(async (tx) => {
      await lockWalletSms(tx, userId);
      const current = await tx.walletNotificationPreference.findUnique({ where: { userId } });
      const data = {
        ...input,
        activationConsentKey: input.activationSmsEnabled
          ? (current?.activationConsentKey ?? randomUUID())
          : null,
      };
      await tx.walletNotificationPreference.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    });
    return this.customer(userId);
  }

  async customer(userId: string): Promise<WalletCustomerNotificationsDto> {
    return this.db.$transaction(async (tx) => {
      const settings = await tx.walletNotificationSettings.findUniqueOrThrow({ where: { id: 1 } });
      const preference = await tx.walletNotificationPreference.findUnique({ where: { userId } });
      const expiryEnabled = preference?.expiryInAppEnabled ?? true;
      const notice = {
        activationSmsEnabled: preference?.activationSmsEnabled ?? false,
        expiryInAppEnabled: expiryEnabled,
        smsAvailable:
          settings.activationSmsEnabled &&
          settings.activationTemplateVersion === activationTemplateVersion,
        expiryReminderAvailable: settings.expiryInAppEnabled,
      };
      if (!settings.expiryInAppEnabled || !expiryEnabled)
        return { ...notice, expiryReminder: null };
      const now = await databaseNow(tx);
      const where = {
        ...spendableWalletLots(userId, now),
        availableToman: { gt: 0 },
      } satisfies Prisma.WalletLotWhereInput;
      const first = await tx.walletLot.findFirst({
        where: {
          ...where,
          expiresAt: { gt: now, lte: new Date(+now + settings.expiryNoticeDays * dayMs) },
        },
        orderBy: { expiresAt: 'asc' },
        select: { expiresAt: true },
      });
      if (!first) return { ...notice, expiryReminder: null };
      const { _sum } = await tx.walletLot.aggregate({
        where: { ...where, expiresAt: first.expiresAt },
        _sum: { availableToman: true },
      });
      return {
        ...notice,
        expiryReminder: _sum.availableToman
          ? {
              urgent: +first.expiresAt <= +now + settings.expiryUrgentDays * dayMs,
              amountToman: _sum.availableToman,
              expiresAt: first.expiresAt.toISOString(),
            }
          : null,
      };
    });
  }

  async prepareDispatch(
    event: { id: string; aggregateId: string; aggregateType: string; payload: unknown },
    claimedAt: Date,
  ): Promise<SendSmsMessage | null> {
    return this.db.$transaction(async (tx) => {
      const where = { id: event.id, status: 'PROCESSING', claimedAt } as const;
      const now = await databaseNow(tx);
      const skip = async (reason: string) => {
        await tx.notificationOutboxEvent.updateMany({
          where,
          data: { status: 'SKIPPED', claimedAt: null, processedAt: now, lastError: reason },
        });
        return null;
      };
      if (event.aggregateType !== 'WALLET_LOT') return skip('WALLET_SMS_INVALID_EVENT');
      const origin = await tx.walletLot.findUnique({
        where: { id: event.aggregateId },
        select: { userId: true },
      });
      if (!origin) return skip('WALLET_SMS_CREDIT_UNAVAILABLE');
      await lockWalletSms(tx, origin.userId);
      await tx.$queryRaw`SELECT id FROM "wallet_notification_settings" WHERE id = 1 FOR SHARE`;
      const settings = await tx.walletNotificationSettings.findUniqueOrThrow({ where: { id: 1 } });
      const preference = await tx.walletNotificationPreference.findUnique({
        where: { userId: origin.userId },
        include: {
          user: { select: { isActive: true, deletedAt: true, phone: true, phoneVerifiedAt: true } },
        },
      });
      const payload = event.payload as {
        amountToman?: number;
        revokedToman?: number;
        expiresAt?: string;
        templateVersion?: string;
        settingsConsentKey?: string;
        customerConsentKey?: string;
      } | null;
      if (
        !settings.activationConsentKey ||
        settings.activationTemplateVersion !== activationTemplateVersion ||
        !preference?.activationConsentKey ||
        !payload ||
        payload.templateVersion !== activationTemplateVersion ||
        payload.settingsConsentKey !== settings.activationConsentKey ||
        payload.customerConsentKey !== preference.activationConsentKey
      )
        return skip('WALLET_SMS_DISABLED');
      if (!preference.user.isActive || preference.user.deletedAt)
        return skip('WALLET_SMS_ACCOUNT_UNAVAILABLE');
      const lot = await tx.walletLot.findUniqueOrThrow({
        where: { id: event.aggregateId },
        select: {
          activatedAt: true,
          expiresAt: true,
          grantedToman: true,
          revokedToman: true,
          referralGrantJob: { select: { nextAttemptAt: true, recoveryDueToman: true } },
        },
      });
      if (!lot.activatedAt || lot.expiresAt <= now) {
        return skip('WALLET_SMS_CREDIT_UNAVAILABLE');
      }
      if (lot.referralGrantJob?.nextAttemptAt || lot.referralGrantJob?.recoveryDueToman) {
        return skip('WALLET_SMS_CREDIT_UNAVAILABLE');
      }
      if (
        typeof payload.amountToman !== 'number' ||
        !Number.isInteger(payload.amountToman) ||
        payload.amountToman <= 0 ||
        typeof payload.revokedToman !== 'number' ||
        !Number.isInteger(payload.revokedToman) ||
        payload.revokedToman < 0 ||
        payload.amountToman + payload.revokedToman !== lot.grantedToman ||
        payload.expiresAt !== lot.expiresAt.toISOString()
      )
        return skip('WALLET_SMS_INVALID_EVENT');
      if (lot.revokedToman > payload.revokedToman) return skip('WALLET_SMS_CREDIT_UNAVAILABLE');
      if (!preference.user.phoneVerifiedAt) throw new Error('WALLET_SMS_PHONE_UNAVAILABLE');
      let phone: string;
      try {
        phone = normalizeIranianMobile(preference.user.phone);
      } catch {
        throw new Error('WALLET_SMS_PHONE_UNAVAILABLE');
      }
      const nextSlot = preference.lastDispatchAt
        ? new Date(+preference.lastDispatchAt + settings.activationIntervalMinutes * minuteMs)
        : now;
      if (nextSlot > now) {
        if (nextSlot >= lot.expiresAt) return skip('WALLET_SMS_CREDIT_UNAVAILABLE');
        await tx.notificationOutboxEvent.updateMany({
          where,
          data: {
            status: 'PENDING',
            claimedAt: null,
            nextAttemptAt: nextSlot,
            attempts: { decrement: 1 },
          },
        });
        return null;
      }
      const dispatching = await tx.notificationOutboxEvent.updateMany({
        where,
        data: { status: 'DISPATCHING' },
      });
      if (dispatching.count !== 1) return null;
      await tx.walletNotificationPreference.update({
        where: { userId: origin.userId },
        data: { lastDispatchAt: now },
      });
      return { phone, text: activationText(payload.amountToman, lot.expiresAt) };
    });
  }
}
