import { IsOptional, IsString, Length } from 'class-validator';

export class ConfirmPaymentRefundDto {
  @IsString()
  @Length(1, 255)
  externalReference!: string;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}
