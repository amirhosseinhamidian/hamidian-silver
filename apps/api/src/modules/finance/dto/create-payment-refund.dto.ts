import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';

export class CreatePaymentRefundDto {
  @IsUUID('4')
  orderId!: string;

  @IsInt()
  @Min(1)
  @Max(TOMAN_INT_MAX)
  amountToman!: number;

  @IsString()
  @Length(8, 120)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}
