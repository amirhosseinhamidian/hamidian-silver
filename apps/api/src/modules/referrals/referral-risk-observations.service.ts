import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { readReferralRiskContext } from './referral-risk-context';

@Injectable()
export class ReferralRiskObservationsService {
  private readonly logger = new Logger(ReferralRiskObservationsService.name);
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async record(userId: string, context: string | undefined, authorization: string | undefined) {
    const observation = readReferralRiskContext(
      this.config.get<string>('REFERRAL_RISK_CONTEXT_SECRET'),
      context,
      authorization,
      new Date(),
    );
    if (!observation) return;
    try {
      await this.db.$executeRaw`
        INSERT INTO "referral_risk_observations" ("userId", "deviceHash", "networkHash", "recordedAt")
        VALUES (${userId}::uuid, ${observation.deviceHash}, ${observation.networkHash}, ${observation.recordedAt})
        ON CONFLICT ("userId") DO UPDATE
        SET "deviceHash" = EXCLUDED."deviceHash", "networkHash" = EXCLUDED."networkHash",
          "recordedAt" = EXCLUDED."recordedAt"
        WHERE "referral_risk_observations"."recordedAt" <= EXCLUDED."recordedAt"
      `;
    } catch {
      this.logger.warn('Could not record referral risk context.');
    }
  }
}
