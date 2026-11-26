import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CartRecoveryService } from './cart-recovery.service';

@Injectable()
export class CartRecoveryScheduler {
  private readonly logger = new Logger(CartRecoveryScheduler.name);

  constructor(private readonly recovery: CartRecoveryService) {}

  @Cron('*/15 * * * *', { name: 'saved-cart-expiration', waitForCompletion: true })
  async expire() {
    try {
      await this.recovery.expireBatch();
    } catch {
      this.logger.error('Could not expire saved carts.');
    }
  }
}
