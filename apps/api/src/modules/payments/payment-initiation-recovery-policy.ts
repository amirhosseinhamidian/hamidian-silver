import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PAYMENT_GATEWAY_CODES,
  isPaymentGatewayCode,
  type PaymentGatewayCode,
} from './payment-gateway.constants';

type RecoveryRedirectInput = {
  provider: string;
  attemptId: string;
  authority: string;
  paymentUrl: string;
};

const ZIBAL_START_PAY_BASE_URL = 'https://gateway.zibal.ir/start/';
const DEFAULT_PAYMENT_CALLBACK_URL = 'http://localhost:3000/api/v1/payments/callback';

@Injectable()
export class PaymentInitiationRecoveryPolicy {
  constructor(private readonly config: ConfigService) {}

  requireCanonicalRedirect(input: RecoveryRedirectInput): string {
    if (!isPaymentGatewayCode(input.provider)) {
      throw new ConflictException(
        'Payment attempt provider does not support manual initiation recovery.',
      );
    }

    const canonicalUrl = this.buildCanonicalUrl(input.provider, input.attemptId, input.authority);

    if (input.paymentUrl !== canonicalUrl) {
      throw new BadRequestException(
        'Recovered payment URL does not match the selected gateway and authority.',
      );
    }

    return canonicalUrl;
  }

  private buildCanonicalUrl(
    provider: PaymentGatewayCode,
    attemptId: string,
    authority: string,
  ): string {
    switch (provider) {
      case PAYMENT_GATEWAY_CODES.ZARINPAL:
        return this.buildZarinpalUrl(authority);
      case PAYMENT_GATEWAY_CODES.ZIBAL:
        return this.buildZibalUrl(authority);
      case PAYMENT_GATEWAY_CODES.MELLAT:
        return this.buildMellatUrl(attemptId, authority);
    }
  }

  private buildZarinpalUrl(authority: string): string {
    const sandbox = this.config.get<boolean>('ZARINPAL_SANDBOX', true);
    const baseUrl = sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay/'
      : 'https://www.zarinpal.com/pg/StartPay/';

    return `${baseUrl}${encodeURIComponent(authority)}`;
  }

  private buildZibalUrl(authority: string): string {
    if (!/^\d+$/.test(authority)) {
      throw new BadRequestException('Recovered Zibal trackId is invalid.');
    }

    const trackId = Number(authority);

    if (!Number.isSafeInteger(trackId) || trackId <= 0) {
      throw new BadRequestException('Recovered Zibal trackId is outside the supported range.');
    }

    return `${ZIBAL_START_PAY_BASE_URL}${encodeURIComponent(authority)}`;
  }

  private buildMellatUrl(attemptId: string, authority: string): string {
    if (!/^[A-Za-z0-9]+$/.test(authority)) {
      throw new BadRequestException('Recovered Mellat RefId is invalid.');
    }

    const callbackBaseUrl = this.config.get<string>(
      'PAYMENT_CALLBACK_URL',
      DEFAULT_PAYMENT_CALLBACK_URL,
    );

    try {
      const parsed = new URL(`${callbackBaseUrl}/${attemptId}`);
      const suffix = `/callback/${attemptId}`;

      if (!parsed.pathname.endsWith(suffix)) {
        throw new Error('invalid callback path');
      }

      parsed.pathname = parsed.pathname.slice(0, -suffix.length) + `/redirect/${attemptId}/mellat`;
      parsed.search = '';
      parsed.hash = '';

      return parsed.toString();
    } catch {
      throw new ConflictException(
        'Payment callback URL cannot produce the canonical Mellat recovery redirect.',
      );
    }
  }
}
