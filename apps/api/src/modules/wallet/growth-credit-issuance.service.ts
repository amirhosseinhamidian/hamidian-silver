import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';

export const growthCreditModes = ['LIVE', 'SHADOW', 'PAUSED'] as const;
export type GrowthCreditMode = (typeof growthCreditModes)[number];

export async function permitsNewGrowthCredit(tx: Prisma.TransactionClient, lock = false) {
  const [control] = await tx.$queryRaw<{ mode: GrowthCreditMode }[]>`
    SELECT mode FROM "growth_credit_issuance_control" WHERE id = 1
    ${lock ? Prisma.sql`FOR SHARE` : Prisma.empty}
  `;
  return control?.mode === 'LIVE';
}

@Injectable()
export class GrowthCreditIssuanceService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async status() {
    const state = await this.db.growthCreditIssuanceControl.findUniqueOrThrow({ where: { id: 1 } });
    return {
      mode: state.mode as GrowthCreditMode,
      version: state.version,
      changedAt: state.changedAt.toISOString(),
      campaignPromotionsEnabled: this.config.get<boolean>('CAMPAIGN_PROMOTIONS_ENABLED', true),
      walletCheckoutEnabled: this.config.get<boolean>('WALLET_CHECKOUT_ENABLED', true),
      referralsEnabled: this.config.get<boolean>('REFERRALS_ENABLED', false),
      walletActivationSmsEnabled: this.config.get<boolean>('WALLET_ACTIVATION_SMS_ENABLED', true),
      purchaseRewardWorkerEnabled: this.config.get<boolean>(
        'PURCHASE_REWARD_WORKER_ENABLED',
        false,
      ),
      referralGrantWorkerEnabled: this.config.get<boolean>('REFERRAL_GRANT_WORKER_ENABLED', false),
      referralRiskWorkerEnabled: this.config.get<boolean>('REFERRAL_RISK_WORKER_ENABLED', false),
      walletMaintenanceEnabled: this.config.get<boolean>('WALLET_MAINTENANCE_ENABLED', false),
    };
  }

  async setMode(mode: GrowthCreditMode, version: number) {
    return this.db.$transaction(async (tx) => {
      const control = await tx.growthCreditIssuanceControl.findUniqueOrThrow({ where: { id: 1 } });
      if (control.version !== version)
        throw new ConflictException('وضعیت صدور اعتبار تغییر کرده است.');
      const updated = await tx.growthCreditIssuanceControl.updateMany({
        where: { id: 1, version },
        data: { mode, version: { increment: 1 } },
      });
      if (!updated.count) throw new ConflictException('وضعیت صدور اعتبار تغییر کرده است.');
      const saved = await tx.growthCreditIssuanceControl.findUniqueOrThrow({ where: { id: 1 } });
      return attachHumanAuditEvent(
        {
          version: saved.version,
          mode: saved.mode as GrowthCreditMode,
          changedAt: saved.changedAt.toISOString(),
        },
        {
          operationType: 'UPDATE',
          title: 'تغییر وضعیت صدور اعتبار',
          entityName: 'صدور اعتبار رشد',
          changes: [{ field: 'mode', label: 'وضعیت', before: control.mode, after: saved.mode }],
        },
      );
    });
  }
}
