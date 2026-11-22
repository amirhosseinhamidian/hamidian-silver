import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { RewardPoliciesController } from './reward-policies.controller';
import { RewardPoliciesService } from './reward-policies.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RewardPoliciesController],
  providers: [RewardPoliciesService],
  exports: [RewardPoliciesService],
})
export class RewardPoliciesModule {}
