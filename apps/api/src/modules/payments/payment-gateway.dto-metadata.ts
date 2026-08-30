import { IsIn, IsOptional } from 'class-validator';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PAYMENT_GATEWAY_CODES } from './payment-gateway.constants';

declare module './dto/initiate-payment.dto' {
  interface InitiatePaymentDto {
    provider?: string;
  }
}

IsOptional()(InitiatePaymentDto.prototype, 'provider');
IsIn(Object.values(PAYMENT_GATEWAY_CODES))(InitiatePaymentDto.prototype, 'provider');
