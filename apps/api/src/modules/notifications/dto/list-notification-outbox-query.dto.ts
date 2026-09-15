import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { NotificationOutboxStatus } from '../../../generated/prisma/enums';

export const NOTIFICATION_OUTBOX_SOURCES = ['CUSTOMER', 'OPERATIONAL'] as const;
export type NotificationOutboxSource = (typeof NOTIFICATION_OUTBOX_SOURCES)[number];

export class ListNotificationOutboxQueryDto {
  @IsOptional()
  @IsEnum(NotificationOutboxStatus)
  status?: NotificationOutboxStatus;

  @IsOptional()
  @IsIn(NOTIFICATION_OUTBOX_SOURCES)
  source?: NotificationOutboxSource;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
