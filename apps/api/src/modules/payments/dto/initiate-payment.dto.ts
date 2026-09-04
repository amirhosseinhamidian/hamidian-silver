import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import {
  PAYMENT_GATEWAY_CODES,
  type PaymentGatewayCode,
} from '../payment-gateway.constants';

export class InitiatePaymentDto {
  @IsString()
  @Length(8, 120)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;

  @IsOptional()
  @IsIn(Object.values(PAYMENT_GATEWAY_CODES))
  @ApiPropertyOptional({ enum: Object.values(PAYMENT_GATEWAY_CODES) })
  provider?: PaymentGatewayCode;
}
