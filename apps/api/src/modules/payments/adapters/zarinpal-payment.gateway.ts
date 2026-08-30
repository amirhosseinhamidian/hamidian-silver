import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  InitiateGatewayPaymentInput,
  InitiateGatewayPaymentResult,
  PaymentGateway,
  VerifyGatewayPaymentInput,
  VerifyGatewayPaymentResult,
} from '../payment-gateway.port';

type ZarinpalErrors = {
  code?: number;
  message?: string;
  validations?: unknown[];
};

type ZarinpalEnvelope<T> = {
  data?: T;
  errors?: ZarinpalErrors | unknown[];
};

type ZarinpalRequestData = {
  code?: number;
  message?: string;
  authority?: string;
};

type ZarinpalVerifyData = {
  code?: number;
  message?: string;
  ref_id?: number | string;
};

const REQUEST_PATH = '/pg/v4/payment/request.json';
const VERIFY_PATH = '/pg/v4/payment/verify.json';
const REQUEST_TIMEOUT_MS = 8_000;

@Injectable()
export class ZarinpalPaymentGateway implements PaymentGateway {
  readonly providerCode = 'zarinpal';

  private readonly merchantId: string;
  private readonly apiBaseUrl: string;
  private readonly startPayBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.merchantId = this.config.get<string>('ZARINPAL_MERCHANT_ID', '');
    const sandbox = this.config.get<boolean>('ZARINPAL_SANDBOX', true);

    this.apiBaseUrl = sandbox ? 'https://sandbox.zarinpal.com' : 'https://api.zarinpal.com';
    this.startPayBaseUrl = sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay/'
      : 'https://www.zarinpal.com/pg/StartPay/';
  }

  async initiate(input: InitiateGatewayPaymentInput): Promise<InitiateGatewayPaymentResult> {
    this.assertConfigured();
    const amount = this.parseRialAmount(input.amountRial);
    const payload = await this.post<ZarinpalRequestData>(REQUEST_PATH, {
      merchant_id: this.merchantId,
      amount,
      callback_url: input.callbackUrl,
      description: `Hamidian Silver order ${input.orderNumber}`,
    });

    if (payload.data?.code !== 100 || !payload.data.authority) {
      throw new BadGatewayException(
        this.getErrorMessage(payload, 'Zarinpal rejected the payment request.'),
      );
    }

    return {
      authority: payload.data.authority,
      paymentUrl: `${this.startPayBaseUrl}${encodeURIComponent(payload.data.authority)}`,
    };
  }

  async verify(input: VerifyGatewayPaymentInput): Promise<VerifyGatewayPaymentResult> {
    this.assertConfigured();
    const amount = this.parseRialAmount(input.amountRial);
    const payload = await this.post<ZarinpalVerifyData>(VERIFY_PATH, {
      merchant_id: this.merchantId,
      amount,
      authority: input.authority,
    });

    const code = payload.data?.code;

    if ((code === 100 || code === 101) && payload.data?.ref_id !== undefined) {
      return {
        success: true,
        referenceId: String(payload.data.ref_id),
      };
    }

    return {
      success: false,
      code: this.getErrorCode(payload),
      message: this.getErrorMessage(payload, 'Zarinpal could not verify the payment.'),
    };
  }

  private assertConfigured(): void {
    if (!this.merchantId) {
      throw new ServiceUnavailableException('Zarinpal merchant ID is not configured.');
    }
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<ZarinpalEnvelope<T>> {
    try {
      const response = await fetch(`${this.apiBaseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const payload = (await response.json()) as ZarinpalEnvelope<T>;

      if (!response.ok) {
        throw new BadGatewayException(
          this.getErrorMessage(payload, 'Zarinpal returned an HTTP error.'),
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new ServiceUnavailableException('Zarinpal is currently unavailable.');
    }
  }

  private parseRialAmount(value: string): number {
    if (!/^\d+$/.test(value)) {
      throw new BadGatewayException('Invalid Rial amount for Zarinpal.');
    }

    const amount = Number(value);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadGatewayException('Rial amount is outside the supported range.');
    }

    return amount;
  }

  private getErrorCode(payload: ZarinpalEnvelope<unknown>): string | undefined {
    if (Array.isArray(payload.errors)) {
      return undefined;
    }

    return payload.errors?.code === undefined ? undefined : String(payload.errors.code);
  }

  private getErrorMessage(payload: ZarinpalEnvelope<unknown>, fallback: string): string {
    if (Array.isArray(payload.errors)) {
      return fallback;
    }

    return payload.errors?.message || fallback;
  }
}
