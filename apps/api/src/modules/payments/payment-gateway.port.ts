export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type InitiateGatewayPaymentInput = {
  attemptId: string;
  orderNumber: string;
  amountRial: string;
  callbackUrl: string;
};

export type InitiateGatewayPaymentResult = {
  authority: string;
  paymentUrl: string;
};

export type VerifyGatewayPaymentInput = {
  authority: string;
  amountRial: string;
};

export type VerifyGatewayPaymentResult =
  | {
      success: true;
      referenceId: string;
    }
  | {
      success: false;
      code?: string;
      message?: string;
    };

export interface PaymentGateway {
  readonly providerCode: string;

  initiate(input: InitiateGatewayPaymentInput): Promise<InitiateGatewayPaymentResult>;

  verify(input: VerifyGatewayPaymentInput): Promise<VerifyGatewayPaymentResult>;
}
