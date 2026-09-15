import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuditController } from './audit.controller';
import { AuditTrailInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditTrailInterceptor,
    },
  ],
})
export class AuditModule {}
