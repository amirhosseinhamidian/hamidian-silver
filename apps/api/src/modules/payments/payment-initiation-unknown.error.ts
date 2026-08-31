import { ServiceUnavailableException } from '@nestjs/common';

export class PaymentInitiationUnknownError extends ServiceUnavailableException {
  constructor(provider: string) {
    super(
      `${provider} payment initiation outcome is unknown; the existing payment attempt must be reviewed before retrying.`,
    );
  }
}

export function isPaymentInitiationUnknownError(
  error: unknown,
): error is PaymentInitiationUnknownError {
  return error instanceof PaymentInitiationUnknownError;
}
