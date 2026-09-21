import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsDeliveryUnknownError } from '../sms-delivery-unknown.error';
import type {
  SendOtpMessage,
  SendSmsMessage,
  SendSmsTemplateMessage,
  SmsSender,
} from '../sms-sender.port';

type KavenegarResponse = {
  return?: {
    status?: number;
  };
};

export class KavenegarSmsSender implements SmsSender {
  private readonly apiKey: string;
  private readonly template: string;
  private readonly sender: string;

  constructor(configService: ConfigService) {
    this.apiKey = configService.getOrThrow<string>('KAVENEGAR_API_KEY');
    this.template = configService.getOrThrow<string>('KAVENEGAR_OTP_TEMPLATE');
    this.sender = configService.get?.<string>('KAVENEGAR_SENDER', '') ?? '';
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

  async sendMessage(message: SendSmsMessage): Promise<void> {
    const url = new URL(
      `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/sms/send.json`,
    );
    const body = new URLSearchParams();

    body.set('receptor', this.toKavenegarReceptor(message.phone));
    body.set('message', message.text);

    if (this.sender) {
      body.set('sender', this.sender);
    }

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new SmsDeliveryUnknownError('Kavenegar');
    }

    if (!response.ok) {
      if (response.status >= 500) {
        throw new SmsDeliveryUnknownError('Kavenegar');
      }

      throw new ServiceUnavailableException('Kavenegar rejected the SMS request.');
    }

    let payload: KavenegarResponse;

    try {
      payload = (await response.json()) as KavenegarResponse;
    } catch {
      throw new SmsDeliveryUnknownError('Kavenegar');
    }

    if (payload.return?.status !== 200) {
      throw new ServiceUnavailableException('Kavenegar rejected the SMS request.');
    }
  }

  async sendTemplate(message: SendSmsTemplateMessage): Promise<void> {
    const url = new URL(
      `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/verify/lookup.json`,
    );

    url.searchParams.set('receptor', this.toKavenegarReceptor(message.phone));
    url.searchParams.set('template', message.template);
    url.searchParams.set('token', message.token);

    for (const key of ['token2', 'token3', 'token10', 'token20'] as const) {
      const value = message[key];
      if (value) url.searchParams.set(key, value);
    }

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new SmsDeliveryUnknownError('Kavenegar');
    }

    if (!response.ok) {
      if (response.status >= 500) {
        throw new SmsDeliveryUnknownError('Kavenegar');
      }

      throw new ServiceUnavailableException('Kavenegar rejected the SMS template request.');
    }

    let payload: KavenegarResponse;

    try {
      payload = (await response.json()) as KavenegarResponse;
    } catch {
      throw new SmsDeliveryUnknownError('Kavenegar');
    }

    if (payload.return?.status !== 200) {
      throw new ServiceUnavailableException('Kavenegar rejected the SMS template request.');
    }
  }

  private toKavenegarReceptor(phone: string): string {
    if (phone.startsWith('+98')) {
      return `0${phone.slice(3)}`;
    }

    return phone;
  }
}
