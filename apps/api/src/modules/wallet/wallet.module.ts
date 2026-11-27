import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { RewardPoliciesModule } from '../reward-policies/reward-policies.module';
import { WalletCheckoutService } from './wallet-checkout.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { GrowthCreditIssuanceController } from './growth-credit-issuance.controller';
import { GrowthCreditIssuanceService } from './growth-credit-issuance.service';
import { WalletController } from './wallet.controller';
import { PurchaseRewardWorker } from './purchase-reward.worker';
import { PurchaseRewardJobsController } from './purchase-reward-jobs.controller';
import { WalletMaintenanceController } from './wallet-maintenance.controller';
import { WalletMaintenanceReportService } from './wallet-maintenance-report.service';
import { WalletMaintenanceScheduler } from './wallet-maintenance.scheduler';
import { WalletMaintenanceService } from './wallet-maintenance.service';

@Module({
  imports: [DatabaseModule, RewardPoliciesModule],
  controllers: [
    WalletController,
    PurchaseRewardJobsController,
    WalletMaintenanceController,
    GrowthCreditIssuanceController,
  ],
  providers: [
    WalletLedgerService,
    GrowthCreditIssuanceService,
    WalletCheckoutService,
    PurchaseRewardWorker,
    WalletMaintenanceService,
    WalletMaintenanceScheduler,
    WalletMaintenanceReportService,
  ],
  exports: [WalletLedgerService, WalletCheckoutService],
})
export class WalletModule {}
