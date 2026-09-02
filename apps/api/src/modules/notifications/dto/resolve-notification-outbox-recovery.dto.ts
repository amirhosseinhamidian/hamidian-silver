import { IsEnum, IsString, Length } from 'class-validator';
import { NotificationOutboxRecoveryResolution } from '../../../generated/prisma/enums';

export class ResolveNotificationOutboxRecoveryDto {
  @IsEnum(NotificationOutboxRecoveryResolution)
  resolution!: NotificationOutboxRecoveryResolution;

  @IsString()
  @Length(3, 1000)
  note!: string;
}
