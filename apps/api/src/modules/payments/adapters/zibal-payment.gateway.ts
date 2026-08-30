import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  InitiateGatewayPaymentInput,
  InitiateGatewayPaymentResult,
  PaymentGateway,
  VerifyGatewayPaymentInput,
  VerifyGatewayPaymentResult,
} from '../payment-gateway.port';

type ZibalResponse = {
  result?: number;
  message?: string;
  trackId?: number | string;
  refNumber?: number | string;
  amount?: number | string;
  status?: number;
};

const API_BASE_URL = 'https://gateway.zibal.ir/v1';
const START_PAY_BASE_URL = 'https://gateway.zibal.ir/start/';
const REQUEST_TIMEOUT_MS = 8_000;

@Injectable()
export class ZibalPaymentGateway implements PaymentGateway {
  readonly providerCode = 'zibal';

  private readonly merchantId: string;

  constructor(private readonly config: ConfigService) {
    this.merchantId = this.config.get<string>('ZIBAL_MERCHANT_ID', '');
  }

  async initiate(input: InitiateGatewayPaymentInput): Promise<InitiateGatewayPaymentResult> {
    this.assertConfigured();

    const amount = this.parseRialAmount(input.amountRial);
    const payload = await this.post('/request', {
      merchant: this.merchantId,
      amount,
      callbackUrl: `${input.callbackUrl}/zibal`,
      description: `Hamidian Silver order ${input.orderNumber}`,
    });

    if (payload.result !== 100 || payload.trackId === undefined) {
      throw new BadGatewayException(payload.message || 'Zibal rejected the payment request.');
    }

    const trackId = this.parseTrackId(payload.trackId);

    return {
      authority: trackId,
      paymentUrl: `${START_PAY_BASE_URL}${encodeURIComponent(trackId)}`,
    };
  }

  async verify(input: VerifyGatewayPaymentInput): Promise<VerifyGatewayPaymentResult> {
    this.assertConfigured();

    const expectedAmount = this.parseRialAmount(input.amountRial);
    const trackId = this.parseTrackId(input.authority);
    const payload = await this.post('/verify', {
      merchant: this.merchantId,
      trackId: this.trackIdForRequest(trackId),
    });

    if (payload.result !== 100 && payload.result !== 201) {
      return {
        success: false,
        code: payload.result === undefined ? undefined : String(payload.result),
        message: payload.message || 'Zibal could not verify the payment.',
      };
    }

    const verifiedAmount = this.parseResponseAmount(payload.amount);

    if (verifiedAmount !== expectedAmount) {
      return {
        success: false,
        code: 'AMOUNT_MISMATCH',
        message: 'Zibal verified a different payment amount.',
      };
    }

    if (payload.status !== undefined && payload.status !== 1) {
      return {
        success: false,
        code: `STATUS_${payload.status}`,
        message: 'Zibal payment status is not verified.',
      };
    }

    if (payload.result === 100 && payload.refNumber === undefined) {
      return {
        success: false,
        code: 'INVALID_RESPONSE',
        message: 'Zibal verification response is missing refNumber.',
      };
    }

    return {
      success: true,
      referenceId: payload.refNumber === undefined ? trackId : String(payload.refNumber),
    };
  }

  private assertConfigured(): void {
    if (!this.merchantId) {
      throw new ServiceUnavailableException('Zibal merchant ID is not configured.');
    }
  }

  private async post(
    path: '/request' | '/verify',
    body: Record<string, unknown>,
  ): Promise<ZibalResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = (await response.json()) as ZibalResponse;

      if (!response.ok) {
        throw new BadGatewayException(payload.message || 'Zibal returned an HTTP error.');
      }

      return payload;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new ServiceUnavailableException('Zibal is currently unavailable.');
    }
  }

  private parseRialAmount(value: string): number {
    if (!/^\d+$/.test(value)) {
      throw new BadGatewayException('Invalid Rial amount for Zibal.');
    }

    const amount = Number(value);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadGatewayException('Rial amount is outside the supported range.');
    }

    return amount;
  }

  private parseResponseAmount(value: number | string | undefined): number {
    if (value === undefined) {
      throw new BadGatewayException('Zibal verification response is missing amount.');
    }

    const normalized = typeof value === 'string' ? value.replaceAll(',', '') : value;
    const amount = typeof normalized === 'number' ? normalized : Number(normalized);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadGatewayException('Zibal verification response contains an invalid amount.');
    }

    return amount;
  }

  private parseTrackId(value: number | string): string {
    const normalized = String(value);

    if (!/^\d+$/.test(normalized)) {
      throw new BadGatewayException('Zibal returned an invalid trackId.');
    }

    const numericValue = Number(normalized);

    if (!Number.isSafeInteger(numericValue) || numericValue <= 0) {
      throw new BadGatewayException('Zibal trackId is outside the supported range.');
    }

    return normalized;
  }

  private trackIdForRequest(trackId: string): number {
    return Number(trackId);
  }
}
