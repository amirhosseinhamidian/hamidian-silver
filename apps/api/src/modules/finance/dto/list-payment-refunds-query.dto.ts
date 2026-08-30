import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaymentRefundStatus } from '../../../generated/prisma/enums';

export class ListPaymentRefundsQueryDto {
  @IsOptional()
  @IsEnum(PaymentRefundStatus)
  status?: PaymentRefundStatus;

  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
