import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PolicyProductOptionsController } from './policy-product-options.controller';
import { PolicySimulationController } from './policy-simulation.controller';
import { PolicySimulationService } from './policy-simulation.service';
import { RewardPoliciesController } from './reward-policies.controller';
import { RewardPoliciesService } from './reward-policies.service';

@Module({
  imports: [DatabaseModule, CatalogModule],
  controllers: [
    RewardPoliciesController,
    PolicySimulationController,
    PolicyProductOptionsController,
  ],
  providers: [RewardPoliciesService, PolicySimulationService],
  exports: [RewardPoliciesService],
})
export class RewardPoliciesModule {}
