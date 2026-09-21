import { ApiProperty } from '@nestjs/swagger';

export class AdminMessageRecipientDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  phone!: string;

  @ApiProperty({ nullable: true })
  firstName!: string | null;

  @ApiProperty({ nullable: true })
  lastName!: string | null;

  @ApiProperty({ enum: ['MANAGER', 'ADMIN'], isArray: true })
  roles!: string[];

  @ApiProperty({ nullable: true })
  telegramChatId!: string | null;

  @ApiProperty({ nullable: true })
  baleChatId!: string | null;
}

export class AdminMessageRecipientSnapshotDto {
  telegramConfigured!: boolean;

  baleConfigured!: boolean;

  @ApiProperty({ type: () => AdminMessageRecipientDto, isArray: true })
  recipients!: AdminMessageRecipientDto[];
}
