import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReferralRiskService } from './referral-risk.service';

@Injectable()
export class ReferralRiskScheduler {
  private readonly logger = new Logger(ReferralRiskScheduler.name);
  constructor(
    private readonly risk: ReferralRiskService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'referral-risk-assessment', waitForCompletion: true })
  async assess() {
    if (this.config.get<boolean>('REFERRAL_RISK_WORKER_ENABLED', false) !== true) return;
    try {
      await this.risk.run();
    } catch {
      this.logger.warn('Referral risk assessment batch could not run.');
    }
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'referral-risk-retention', waitForCompletion: true })
  async cleanup() {
    try {
      await this.risk.cleanup();
    } catch {
      this.logger.warn('Referral risk evidence cleanup could not run.');
    }
  }
}
