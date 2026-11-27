import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignsService } from './campaigns.service';

@Injectable()
export class CampaignPublisher {
  constructor(private readonly campaigns: CampaignsService) {}

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async tick(): Promise<void> {
    await this.campaigns.advance();
  }
}
