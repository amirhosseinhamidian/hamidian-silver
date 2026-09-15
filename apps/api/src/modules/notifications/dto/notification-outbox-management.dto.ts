import { ApiProperty } from '@nestjs/swagger';

import {
  NotificationOutboxRecoveryResolution,
  NotificationOutboxStatus,
} from '../../../generated/prisma/enums';
import { NOTIFICATION_OUTBOX_SOURCES } from './list-notification-outbox-query.dto';

export class NotificationOutboxRecoveryHistoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NotificationOutboxRecoveryResolution })
  resolution!: NotificationOutboxRecoveryResolution;

  note!: string;

  @ApiProperty({ nullable: true })
  unknownReasonSnapshot!: string | null;

  @ApiProperty({ format: 'uuid' })
  resolvedByUserId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class NotificationOutboxItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NOTIFICATION_OUTBOX_SOURCES })
  source!: string;

  eventType!: string;
  aggregateType!: string;

  @ApiProperty({ format: 'uuid' })
  aggregateId!: string;

  @ApiProperty({ nullable: true })
  recipientPhone!: string | null;

  @ApiProperty({ nullable: true })
  priority!: string | null;

  @ApiProperty({ nullable: true })
  level!: string | null;

  @ApiProperty({ enum: NotificationOutboxStatus })
  status!: NotificationOutboxStatus;

  attempts!: number;

  @ApiProperty({ format: 'date-time' })
  nextAttemptAt!: string;

  @ApiProperty({ nullable: true, format: 'date-time' })
  claimedAt!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  processedAt!: string | null;

  @ApiProperty({ nullable: true })
  lastError!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: () => NotificationOutboxRecoveryHistoryDto, isArray: true })
  recoveries!: NotificationOutboxRecoveryHistoryDto[];
}

export class NotificationOutboxSummaryDto {
  total!: number;
  pending!: number;
  processing!: number;
  dispatching!: number;
  sent!: number;
  failed!: number;
  unknown!: number;
}

export class NotificationOutboxManagementSnapshotDto {
  @ApiProperty({ type: () => NotificationOutboxItemDto, isArray: true })
  items!: NotificationOutboxItemDto[];

  @ApiProperty({ type: () => NotificationOutboxSummaryDto })
  summary!: NotificationOutboxSummaryDto;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;
}
