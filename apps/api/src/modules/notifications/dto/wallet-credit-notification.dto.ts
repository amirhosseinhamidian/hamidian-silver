import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class WalletNotificationPreferencesDto {
  @Type(() => Object)
  @IsBoolean()
  activationSmsEnabled!: boolean;

  @Type(() => Object)
  @IsBoolean()
  expiryInAppEnabled!: boolean;
}

export class UpdateWalletNotificationSettingsDto extends WalletNotificationPreferencesDto {
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(2_147_483_646)
  expectedVersion!: number;

  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(1440)
  activationIntervalMinutes!: number;

  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(90)
  expiryNoticeDays!: number;

  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(90)
  expiryUrgentDays!: number;
}

export class WalletNotificationSettingsDto extends WalletNotificationPreferencesDto {
  version!: number;
  activationIntervalMinutes!: number;
  expiryNoticeDays!: number;
  expiryUrgentDays!: number;
  activationSmsPreview!: string;
}

class WalletExpiryReminderDto {
  urgent!: boolean;
  amountToman!: number;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export class WalletCustomerNotificationsDto extends WalletNotificationPreferencesDto {
  smsAvailable!: boolean;
  expiryReminderAvailable!: boolean;

  @ApiProperty({ type: WalletExpiryReminderDto, nullable: true })
  expiryReminder!: WalletExpiryReminderDto | null;
}
