import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreatePaymentRefundDto {
  @IsUUID('4')
  orderId!: string;

  @IsInt()
  @Min(1)
  amountToman!: number;

  @IsString()
  @Length(8, 120)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}
