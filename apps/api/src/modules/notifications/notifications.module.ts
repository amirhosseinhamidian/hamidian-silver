import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationOutboxService } from './notification-outbox.service';
import { NotificationOutboxWorker } from './notification-outbox.worker';

@Global()
@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [NotificationOutboxService, NotificationOutboxWorker],
  exports: [NotificationOutboxService],
})
export class NotificationsModule {}
