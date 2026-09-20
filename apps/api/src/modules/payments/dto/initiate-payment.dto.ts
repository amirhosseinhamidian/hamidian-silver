import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { PAYMENT_GATEWAY_DEFINITIONS, type PaymentGatewayCode } from '../payment-gateway.constants';

const INITIABLE_PAYMENT_GATEWAY_CODES = PAYMENT_GATEWAY_DEFINITIONS.map(({ code }) => code);

export class InitiatePaymentDto {
  @IsString()
  @Length(8, 120)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;

  @IsOptional()
  @IsIn(INITIABLE_PAYMENT_GATEWAY_CODES)
  @ApiPropertyOptional({ enum: INITIABLE_PAYMENT_GATEWAY_CODES })
  provider?: PaymentGatewayCode;
}
