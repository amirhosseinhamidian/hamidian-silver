import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AdminMessageRecipientsController } from './admin-message-recipients.controller';
import { AdminMessageRecipientsService } from './admin-message-recipients.service';
import { AdminMessageSender } from './admin-message.sender';
import { AdminOrderNotificationOutboxService } from './admin-order-notification-outbox.service';
import { AdminOrderNotificationWorker } from './admin-order-notification.worker';
import { NotificationOutboxRecoveryController } from './notification-outbox-recovery.controller';
import { NotificationOutboxRecoveryService } from './notification-outbox-recovery.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { NotificationOutboxWorker } from './notification-outbox.worker';
import { OperationalAlertOutboxService } from './operational-alert-outbox.service';
import { OperationalAlertOutboxWorker } from './operational-alert-outbox.worker';
import { StockNotificationsController } from './stock-notifications.controller';
import { StockNotificationsService } from './stock-notifications.service';

@Global()
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    AdminMessageRecipientsController,
    NotificationOutboxRecoveryController,
    StockNotificationsController,
  ],
  providers: [
    AdminMessageRecipientsService,
    AdminMessageSender,
    AdminOrderNotificationOutboxService,
    AdminOrderNotificationWorker,
    NotificationOutboxRecoveryService,
    NotificationOutboxService,
    NotificationOutboxWorker,
    OperationalAlertOutboxService,
    OperationalAlertOutboxWorker,
    StockNotificationsService,
  ],
  exports: [
    AdminOrderNotificationOutboxService,
    NotificationOutboxService,
    OperationalAlertOutboxService,
  ],
})
export class NotificationsModule {}
