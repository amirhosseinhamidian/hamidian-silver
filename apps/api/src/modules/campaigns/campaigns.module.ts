import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { CampaignOperationsCenterController } from './campaign-operations-center.controller';
import { CampaignOperationsCenterService } from './campaign-operations-center.service';
import { CampaignQuotasController } from './campaign-quotas.controller';
import { CampaignQuotasService } from './campaign-quotas.service';
import { CatalogModule } from '../catalog/catalog.module';
import { CampaignPublisher } from './campaign-publisher';
import { CampaignLandingsController } from './campaign-landings.controller';
import { CampaignLandingsService } from './campaign-landings.service';
import { CampaignsController } from './campaigns.controller';
import { FestivalDesignController } from './festival-design.controller';
import { FestivalDesignService } from './festival-design.service';
import { FestivalThemeLibraryController } from './festival-theme-library.controller';
import { FestivalThemeLibraryService } from './festival-theme-library.service';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [DatabaseModule, CatalogModule, PromotionsModule],
  controllers: [
    CampaignsController,
    CampaignLandingsController,
    CampaignQuotasController,
    FestivalDesignController,
    FestivalThemeLibraryController,
    CampaignOperationsCenterController,
  ],
  providers: [
    CampaignsService,
    CampaignPublisher,
    CampaignLandingsService,
    CampaignQuotasService,
    FestivalDesignService,
    FestivalThemeLibraryService,
    CampaignOperationsCenterService,
  ],
})
export class CampaignsModule {}
