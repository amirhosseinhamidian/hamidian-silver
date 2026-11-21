import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CampaignPublisher } from './campaign-publisher';
import { CampaignLandingsController } from './campaign-landings.controller';
import { CampaignLandingsService } from './campaign-landings.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [DatabaseModule, CatalogModule],
  controllers: [CampaignsController, CampaignLandingsController],
  providers: [CampaignsService, CampaignPublisher, CampaignLandingsService],
})
export class CampaignsModule {}
