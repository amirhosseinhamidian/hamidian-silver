import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationOutboxRecoveryController } from './notification-outbox-recovery.controller';
import { NotificationOutboxRecoveryService } from './notification-outbox-recovery.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { NotificationOutboxWorker } from './notification-outbox.worker';
import { OperationalAlertOutboxService } from './operational-alert-outbox.service';
import { OperationalAlertOutboxWorker } from './operational-alert-outbox.worker';

@Global()
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [NotificationOutboxRecoveryController],
  providers: [
    NotificationOutboxRecoveryService,
    NotificationOutboxService,
    NotificationOutboxWorker,
    OperationalAlertOutboxService,
    OperationalAlertOutboxWorker,
  ],
  exports: [NotificationOutboxService, OperationalAlertOutboxService],
})
export class NotificationsModule {}
