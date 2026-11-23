import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [WalletController],
  providers: [WalletLedgerService],
  exports: [WalletLedgerService],
})
export class WalletModule {}
