import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderExpirationService } from './order-expiration.service';

@Injectable()
export class OrderExpirationScheduler {
  private readonly logger = new Logger(OrderExpirationScheduler.name);
  private isRunning = false;

  constructor(private readonly orderExpirationService: OrderExpirationService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'order-expiration',
    waitForCompletion: true,
  })
  async handleExpirationTick(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Skipping order expiration tick because the previous run is still active.');
      return;
    }

    this.isRunning = true;

    try {
      const result = await this.orderExpirationService.expireDueOrders();

      if (result.expired > 0 || result.skipped > 0) {
        this.logger.log(
          `Order expiration sweep scanned=${result.scanned} expired=${result.expired} skipped=${result.skipped}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown order expiration error';
      this.logger.error(`Order expiration sweep failed: ${message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
