import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentInitiationUnknownError } from '../payment-initiation-unknown.error';
import type {
  InitiateGatewayPaymentInput,
  InitiateGatewayPaymentResult,
  PaymentGateway,
  VerifyGatewayPaymentInput,
  VerifyGatewayPaymentResult,
} from '../payment-gateway.port';

type IranDargahResponse = {
  success?: boolean;
  message?: string;
  error?: string | { message?: string; code?: string | number };
  data?: {
    transaction?: {
      authority?: string;
      gateway_url?: string;
      amount?: number | string;
      order_id?: string;
    };
    verification?: {
      authority?: string;
      ref_id?: string | number;
      amount?: number | string;
      order_id?: string;
    };
  };
};

const PRODUCTION_API_BASE_URL = 'https://ipg.irandargah.com';
const SANDBOX_API_BASE_URL = 'https://sandbox.irandargah.com';
const MIN_AMOUNT_RIAL = 100_000;
const MAX_AMOUNT_RIAL = 4_000_000_000;

@Injectable()
export class IranDargahPaymentGateway implements PaymentGateway {
  readonly providerCode = 'irandargah';

  private readonly apiToken: string;
  private readonly apiBaseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly sandbox: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiToken = this.config.get<string>('IRANDARGAH_API_TOKEN', '');
    this.sandbox = this.config.get<boolean>('IRANDARGAH_SANDBOX', true);
    this.apiBaseUrl = this.sandbox ? SANDBOX_API_BASE_URL : PRODUCTION_API_BASE_URL;
    this.requestTimeoutMs = this.config.get<number>('IRANDARGAH_REQUEST_TIMEOUT_MS', 8_000);
  }

  async initiate(input: InitiateGatewayPaymentInput): Promise<InitiateGatewayPaymentResult> {
    this.assertConfigured();
    const amount = this.parseRialAmount(input.amountRial);
    this.assertOrderNumber(input.orderNumber);
    this.assertCallbackUrl(input.callbackUrl);

    const payload = await this.post(
      '/v2/payments',
      {
        amount,
        order_id: input.orderNumber,
        callback_url: input.callbackUrl,
        description: `Hamidian Silver order ${input.orderNumber}`,
        action: 'GET',
        direct_verify: false,
      },
      `payment-${input.attemptId}`,
      true,
    );
    const transaction = payload.data?.transaction;

    if (payload.success !== true || !transaction?.authority || !transaction.gateway_url) {
      throw new BadGatewayException(
        this.responseMessage(payload, 'IranDargah rejected the payment request.'),
      );
    }

    return {
      authority: transaction.authority,
      paymentUrl: this.requireTrustedGatewayUrl(transaction.gateway_url),
    };
  }

  async verify(input: VerifyGatewayPaymentInput): Promise<VerifyGatewayPaymentResult> {
    this.assertConfigured();
    const expectedAmount = this.parseRialAmount(input.amountRial);
    const payload = await this.post(
      '/v2/verifications',
      {
        authority: input.authority,
        amount: expectedAmount,
      },
      `verification-${input.authority}`,
    );
    const verification = payload.data?.verification;

    if (payload.success !== true || !verification?.ref_id) {
      return {
        success: false,
        code: this.responseCode(payload),
        message: this.responseMessage(payload, 'IranDargah could not verify the payment.'),
      };
    }

    if (verification.authority && verification.authority !== input.authority) {
      return {
        success: false,
        code: 'AUTHORITY_MISMATCH',
        message: 'IranDargah verified a different payment authority.',
      };
    }

    if (this.parseResponseAmount(verification.amount) !== expectedAmount) {
      return {
        success: false,
        code: 'AMOUNT_MISMATCH',
        message: 'IranDargah verified a different payment amount.',
      };
    }

    return {
      success: true,
      referenceId: String(verification.ref_id),
    };
  }

  private assertConfigured(): void {
    const expectedPrefix = this.sandbox ? 'idg_test_' : 'idg_live_';

    if (!this.apiToken || !this.apiToken.startsWith(expectedPrefix)) {
      throw new ServiceUnavailableException(
        `IranDargah ${this.sandbox ? 'test' : 'live'} API token is not configured.`,
      );
    }
  }

  private async post(
    path: '/v2/payments' | '/v2/verifications',
    body: Record<string, unknown>,
    idempotencyKey: string,
    initiationUnknownOnTransport = false,
  ): Promise<IranDargahResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
      const payload = (await response.json()) as IranDargahResponse;

      if (!response.ok && [401, 403, 429].includes(response.status)) {
        throw new ServiceUnavailableException('IranDargah credentials or service are unavailable.');
      }

      if (response.status >= 500) {
        throw new ServiceUnavailableException('IranDargah returned a server error.');
      }

      return payload;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof ServiceUnavailableException && !initiationUnknownOnTransport) {
        throw error;
      }
      if (initiationUnknownOnTransport) throw new PaymentInitiationUnknownError('IranDargah');
      throw new ServiceUnavailableException('IranDargah is currently unavailable.');
    }
  }

  private parseRialAmount(value: string): number {
    if (!/^\d+$/.test(value)) {
      throw new BadGatewayException('Invalid Rial amount for IranDargah.');
    }

    const amount = Number(value);

    if (!Number.isSafeInteger(amount) || amount < MIN_AMOUNT_RIAL || amount > MAX_AMOUNT_RIAL) {
      throw new BadGatewayException(
        `IranDargah supports amounts between ${MIN_AMOUNT_RIAL} and ${MAX_AMOUNT_RIAL} Rial.`,
      );
    }

    return amount;
  }

  private parseResponseAmount(value: number | string | undefined): number {
    if (value === undefined || !/^\d+$/.test(String(value))) {
      throw new BadGatewayException('IranDargah verification response is missing amount.');
    }

    const amount = Number(value);

    if (!Number.isSafeInteger(amount)) {
      throw new BadGatewayException('IranDargah verification amount is invalid.');
    }

    return amount;
  }

  private assertOrderNumber(orderNumber: string): void {
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(orderNumber)) {
      throw new BadGatewayException('Order number is not valid for IranDargah.');
    }
  }

  private assertCallbackUrl(callbackUrl: string): void {
    try {
      const parsed = new URL(callbackUrl);
      const localDevelopmentUrl =
        parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);

      if (parsed.protocol !== 'https:' && !localDevelopmentUrl) throw new Error('unsafe protocol');
    } catch {
      throw new BadGatewayException('IranDargah callback URL must be a valid HTTPS URL.');
    }
  }

  private requireTrustedGatewayUrl(value: string): string {
    try {
      const parsed = new URL(value);

      if (parsed.protocol !== 'https:' || parsed.origin !== this.apiBaseUrl) {
        throw new Error('untrusted gateway URL');
      }

      return parsed.toString();
    } catch {
      throw new PaymentInitiationUnknownError('IranDargah');
    }
  }

  private responseMessage(payload: IranDargahResponse, fallback: string): string {
    if (typeof payload.message === 'string' && payload.message) return payload.message;
    if (typeof payload.error === 'string' && payload.error) return payload.error;
    if (typeof payload.error === 'object' && payload.error?.message) return payload.error.message;
    return fallback;
  }

  private responseCode(payload: IranDargahResponse): string | undefined {
    return typeof payload.error === 'object' && payload.error?.code !== undefined
      ? String(payload.error.code)
      : undefined;
  }
}
