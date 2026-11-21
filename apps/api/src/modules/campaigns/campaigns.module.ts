import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CampaignPublisher } from './campaign-publisher';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [DatabaseModule, CatalogModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignPublisher],
})
export class CampaignsModule {}
