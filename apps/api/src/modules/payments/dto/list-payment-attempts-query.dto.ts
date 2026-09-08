import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { PaymentAttemptStatus } from '../../../generated/prisma/enums';
import { PAYMENT_GATEWAY_CODES, type PaymentGatewayCode } from '../payment-gateway.constants';

export class ListPaymentAttemptsQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  q?: string;

  @IsOptional()
  @IsEnum(PAYMENT_GATEWAY_CODES)
  provider?: PaymentGatewayCode;

  @IsOptional()
  @IsEnum(PaymentAttemptStatus)
  status?: PaymentAttemptStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
