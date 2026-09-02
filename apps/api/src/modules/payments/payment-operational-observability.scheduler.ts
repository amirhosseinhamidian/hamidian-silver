import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentOperationalObservabilityService } from './payment-operational-observability.service';

@Injectable()
export class PaymentOperationalObservabilityScheduler {
  private readonly logger = new Logger(PaymentOperationalObservabilityScheduler.name);
  private running = false;

  constructor(private readonly observabilityService: PaymentOperationalObservabilityService) {}

  @Cron('30 */5 * * * *', {
    name: 'payment-operational-observability-scan',
  })
  async scan(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.observabilityService.scan(new Date());
    } catch (error) {
      this.logger.error(
        `Payment operational observability scan failed: ${this.errorMessage(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
