import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  InitiateGatewayPaymentInput,
  InitiateGatewayPaymentResult,
  PaymentGateway,
  VerifyGatewayPaymentInput,
  VerifyGatewayPaymentResult,
} from '../payment-gateway.port';

@Injectable()
export class DisabledPaymentGateway implements PaymentGateway {
  readonly providerCode = 'disabled';

  initiate(_input: InitiateGatewayPaymentInput): Promise<InitiateGatewayPaymentResult> {
    throw new ServiceUnavailableException('Payment gateway is not configured.');
  }

  verify(_input: VerifyGatewayPaymentInput): Promise<VerifyGatewayPaymentResult> {
    throw new ServiceUnavailableException('Payment gateway is not configured.');
  }
}
