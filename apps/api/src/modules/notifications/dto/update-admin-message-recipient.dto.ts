import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

const CHAT_ID_PATTERN = /^-?\d{1,20}$/;

export class UpdateAdminMessageRecipientDto {
  @ApiPropertyOptional({ nullable: true, example: '123456789' })
  @IsOptional()
  @IsString()
  @Matches(CHAT_ID_PATTERN)
  telegramChatId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '123456789' })
  @IsOptional()
  @IsString()
  @Matches(CHAT_ID_PATTERN)
  baleChatId?: string | null;
}
