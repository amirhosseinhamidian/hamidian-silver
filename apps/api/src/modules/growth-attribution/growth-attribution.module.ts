import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CampaignLinksService } from './campaign-links.service';
import { GrowthAttributionController } from './growth-attribution.controller';
import { GrowthDashboardService } from './growth-dashboard.service';
import { GrowthMeasurementService } from './growth-measurement.service';
import { GrowthRevenueService } from './growth-revenue.service';

@Module({
  imports: [DatabaseModule],
  controllers: [GrowthAttributionController],
  providers: [
    CampaignLinksService,
    GrowthRevenueService,
    GrowthDashboardService,
    GrowthMeasurementService,
  ],
})
export class GrowthAttributionModule {}
