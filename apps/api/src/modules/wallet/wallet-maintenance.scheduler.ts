import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WalletMaintenanceService } from './wallet-maintenance.service';

@Injectable()
export class WalletMaintenanceScheduler {
  private readonly logger = new Logger(WalletMaintenanceScheduler.name);
  private expiryCursor: { expiresAt: Date; id: string } | null = null;
  private reservationCursor: string | null = null;
  private lotCursor: string | null = null;

  constructor(
    private readonly maintenance: WalletMaintenanceService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'wallet-expiration', waitForCompletion: true })
  async expire() {
    if (this.config.get<boolean>('WALLET_MAINTENANCE_ENABLED', false) !== true) return;
    try {
      const result = await this.maintenance.expireBatch(this.expiryCursor);
      this.expiryCursor = result.next;
      if (result.expired || result.failed) {
        this.logger.log(`Wallet expiry expired=${result.expired} failed=${result.failed}`);
      }
    } catch (error) {
      this.logFailure('expiry', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'wallet-reconciliation',
    waitForCompletion: true,
  })
  async reconcile() {
    if (this.config.get<boolean>('WALLET_MAINTENANCE_ENABLED', false) !== true) return;
    try {
      const result = await this.maintenance.reconcileReservations(this.reservationCursor);
      this.reservationCursor = result.next;
      if (result.released || result.failed) {
        this.logger.log(
          `Wallet reconciliation released=${result.released} failed=${result.failed}`,
        );
      }
    } catch (error) {
      this.logFailure('reservation reconciliation', error);
    }
    try {
      const result = await this.maintenance.reconcileLots(this.lotCursor);
      this.lotCursor = result.next;
    } catch (error) {
      this.logFailure('lot reconciliation', error);
    }
  }

  private logFailure(operation: string, error: unknown) {
    this.logger.error(
      `Wallet ${operation} sweep failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
    );
  }
}
