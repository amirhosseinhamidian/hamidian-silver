import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { RewardPoliciesModule } from '../reward-policies/reward-policies.module';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralGrantWorker } from './referral-grant.worker';
import { ReferralGrantController } from './referral-grant.controller';
import { ReferralGrantReportService } from './referral-grant-report.service';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralRewardPoliciesController } from './referral-reward-policies.controller';
import { ReferralRewardPoliciesService } from './referral-reward-policies.service';
import { ReferralRiskController } from './referral-risk.controller';
import { ReferralRiskEvidenceService } from './referral-risk-evidence.service';
import { ReferralRiskObservationsService } from './referral-risk-observations.service';
import { ReferralRiskPoliciesService } from './referral-risk-policies.service';
import { ReferralRiskScheduler } from './referral-risk.scheduler';
import { ReferralRiskService } from './referral-risk.service';

@Module({
  imports: [DatabaseModule, RewardPoliciesModule, WalletModule],
  controllers: [
    ReferralsController,
    ReferralRewardPoliciesController,
    ReferralRiskController,
    ReferralGrantController,
  ],
  providers: [
    ReferralsService,
    ReferralRewardPoliciesService,
    ReferralRiskObservationsService,
    ReferralRiskPoliciesService,
    ReferralRiskEvidenceService,
    ReferralRiskService,
    ReferralRiskScheduler,
    ReferralGrantWorker,
    ReferralGrantReportService,
  ],
})
export class ReferralsModule {}
