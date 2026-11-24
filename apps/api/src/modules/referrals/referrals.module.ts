import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralRewardPoliciesController } from './referral-reward-policies.controller';
import { ReferralRewardPoliciesService } from './referral-reward-policies.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ReferralsController, ReferralRewardPoliciesController],
  providers: [ReferralsService, ReferralRewardPoliciesService],
})
export class ReferralsModule {}
