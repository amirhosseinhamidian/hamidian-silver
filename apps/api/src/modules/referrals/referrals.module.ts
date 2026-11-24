import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
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
  imports: [DatabaseModule],
  controllers: [ReferralsController, ReferralRewardPoliciesController, ReferralRiskController],
  providers: [
    ReferralsService,
    ReferralRewardPoliciesService,
    ReferralRiskObservationsService,
    ReferralRiskPoliciesService,
    ReferralRiskEvidenceService,
    ReferralRiskService,
    ReferralRiskScheduler,
  ],
})
export class ReferralsModule {}
