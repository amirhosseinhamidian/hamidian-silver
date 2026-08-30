import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OperationalAlertsService } from './operational-alerts.service';

@Injectable()
export class OperationalAlertsScheduler {
  private readonly logger = new Logger(OperationalAlertsScheduler.name);
  private running = false;

  constructor(private readonly operationalAlertsService: OperationalAlertsService) {}

  @Cron('0 */5 * * * *', {
    name: 'operational-alert-scan',
  })
  async scan(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.operationalAlertsService.scan(new Date());
    } catch (error) {
      this.logger.error(`Operational alert scan failed: ${this.errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
