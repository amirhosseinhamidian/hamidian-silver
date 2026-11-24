import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { RewardPoliciesModule } from '../reward-policies/reward-policies.module';
import { WalletCheckoutService } from './wallet-checkout.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletController } from './wallet.controller';
import { PurchaseRewardWorker } from './purchase-reward.worker';
import { PurchaseRewardJobsController } from './purchase-reward-jobs.controller';

@Module({
  imports: [DatabaseModule, RewardPoliciesModule],
  controllers: [WalletController, PurchaseRewardJobsController],
  providers: [WalletLedgerService, WalletCheckoutService, PurchaseRewardWorker],
  exports: [WalletLedgerService, WalletCheckoutService],
})
export class WalletModule {}
