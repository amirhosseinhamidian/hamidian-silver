import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../infrastructure/database/database.module';
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';

@Module({
  imports: [DatabaseModule],
  controllers: [UserManagementController],
  providers: [UserManagementService],
})
export class UserManagementModule {}
