import { ServiceUnavailableException } from '@nestjs/common';

export class SmsDeliveryUnknownError extends ServiceUnavailableException {
  constructor(provider: string) {
    super(
      `${provider} SMS delivery outcome is unknown; review the provider before retrying this message.`,
    );
  }
}

export function isSmsDeliveryUnknownError(error: unknown): error is SmsDeliveryUnknownError {
  return error instanceof SmsDeliveryUnknownError;
}
