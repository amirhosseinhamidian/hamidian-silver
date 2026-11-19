import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CampaignLinksService } from './campaign-links.service';
import { GrowthAttributionController } from './growth-attribution.controller';
import { GrowthRevenueService } from './growth-revenue.service';

@Module({
  imports: [DatabaseModule],
  controllers: [GrowthAttributionController],
  providers: [CampaignLinksService, GrowthRevenueService],
})
export class GrowthAttributionModule {}
