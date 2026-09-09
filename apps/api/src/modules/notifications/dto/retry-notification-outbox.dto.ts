import { IsString, Length } from 'class-validator';

export class RetryNotificationOutboxDto {
  @IsString()
  @Length(3, 1000)
  note!: string;
}
