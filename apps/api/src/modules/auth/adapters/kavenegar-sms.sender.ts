import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SendOtpMessage, SmsSender } from '../sms-sender.port';

type KavenegarResponse = {
  return?: {
    status?: number;
  };
};

export class KavenegarSmsSender implements SmsSender {
  private readonly apiKey: string;
  private readonly template: string;

  constructor(configService: ConfigService) {
    this.apiKey = configService.getOrThrow<string>('KAVENEGAR_API_KEY');
    this.template = configService.getOrThrow<string>('KAVENEGAR_OTP_TEMPLATE');
  }

  async sendOtp(message: SendOtpMessage): Promise<void> {
    const url = new URL(
      `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/verify/lookup.json`,
    );

    url.searchParams.set('receptor', this.toKavenegarReceptor(message.phone));
    url.searchParams.set('token', message.code);
    url.searchParams.set('template', this.template);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        throw new Error(`Kavenegar HTTP ${response.status}`);
      }

      const payload = (await response.json()) as KavenegarResponse;

      if (payload.return?.status !== 200) {
        throw new Error('Kavenegar rejected the OTP request.');
      }
    } catch {
      throw new ServiceUnavailableException('SMS delivery is temporarily unavailable.');
    }
  }

  private toKavenegarReceptor(phone: string): string {
    if (phone.startsWith('+98')) {
      return `0${phone.slice(3)}`;
    }

    return phone;
  }
}
