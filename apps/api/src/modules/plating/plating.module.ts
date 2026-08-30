import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { PlatingController } from './plating.controller';
import { PlatingService } from './plating.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlatingController],
  providers: [PlatingService],
})
export class PlatingModule {}
