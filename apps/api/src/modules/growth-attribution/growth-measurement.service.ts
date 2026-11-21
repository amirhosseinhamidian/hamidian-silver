import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { GrowthMeasurementDto } from './dto/growth-dashboard.dto';

@Injectable()
export class GrowthMeasurementService {
  private readonly logger = new Logger(GrowthMeasurementService.name);
  private windowStartedAt = 0;
  private acceptedInWindow = 0;
  private pending = 0;

  constructor(private readonly prisma: PrismaService) {}

  async record(event: GrowthMeasurementDto): Promise<void> {
    const now = Date.now();
    if (now - this.windowStartedAt >= 1000) {
      this.windowStartedAt = now;
      this.acceptedInWindow = 0;
    }
    if (this.acceptedInWindow >= 80 || this.pending >= 4) {
      throw new HttpException('Growth measurement is busy.', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.acceptedInWindow += 1;
    this.pending += 1;
    try {
      const hasSource = Boolean(event.source && event.medium);
      await this.prisma.growthFunnelEvent.createMany({
        skipDuplicates: true,
        data: {
          id: event.id,
          visitId: event.visitId,
          stage: event.stage,
          device: event.device,
          source: hasSource ? event.source : null,
          medium: hasSource ? event.medium : null,
          campaign: hasSource ? event.campaign : null,
          campaignId: hasSource && event.campaign ? event.campaignId : null,
          productSlugs: [...new Set(event.productSlugs)],
        },
      });
    } finally {
      this.pending -= 1;
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { waitForCompletion: true })
  async prune(): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        DELETE FROM growth_funnel_events WHERE id IN (
          SELECT id FROM growth_funnel_events
          WHERE "recordedAt" < CURRENT_TIMESTAMP - INTERVAL '93 days'
          ORDER BY "recordedAt" LIMIT 3000 FOR UPDATE SKIP LOCKED
        )
      `;
    } catch {
      this.logger.warn('Growth measurement retention could not be applied.');
    }
  }
}
