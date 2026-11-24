import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
