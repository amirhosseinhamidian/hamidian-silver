import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AdminMessageChannel } from '../../generated/prisma/enums';

type BotApiResponse = Readonly<{
  ok?: boolean;
  code?: string;
  description?: string;
  retryAfterSeconds?: number;
}>;

@Injectable()
export class AdminMessageSender {
  private readonly timeoutMs: number;
  private readonly telegramRelayUrl: string | undefined;
  private readonly telegramRelaySecret: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.timeoutMs = this.config.get<number>('ADMIN_MESSAGING_REQUEST_TIMEOUT_MS', 8000);
    this.telegramRelayUrl = this.config.get<string>('TELEGRAM_RELAY_URL')?.trim() || undefined;
    this.telegramRelaySecret =
      this.config.get<string>('TELEGRAM_RELAY_SECRET')?.trim() || undefined;
  }

  async send(channel: AdminMessageChannel, chatId: string, message: string): Promise<void> {
    if (channel === AdminMessageChannel.TELEGRAM) {
      if (this.telegramRelayUrl || this.telegramRelaySecret) {
        await this.sendTelegramThroughRelay(chatId, message);
        return;
      }

      await this.sendDirectBotMessage(
        channel,
        'TELEGRAM_BOT_TOKEN',
        'https://api.telegram.org',
        chatId,
        message,
      );
      return;
    }

    await this.sendDirectBotMessage(
      channel,
      'BALE_BOT_TOKEN',
      'https://tapi.bale.ai',
      chatId,
      message,
    );
  }

  private async sendTelegramThroughRelay(chatId: string, message: string): Promise<void> {
    if (!this.telegramRelayUrl || !this.telegramRelaySecret) {
      throw new Error('TELEGRAM_RELAY_URL and TELEGRAM_RELAY_SECRET must be configured together.');
    }

    let response: Response;
    try {
      response = await fetch(this.telegramRelayUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.telegramRelaySecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, message }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new Error(
        `TELEGRAM relay request failed before a response: ${this.networkError(error)}.`,
      );
    }

    const payload = await this.readResponse(response);
    if (!response.ok || payload?.ok !== true) {
      throw new Error(
        `TELEGRAM relay rejected the message: ${this.failureDescription(payload, response)}.`,
      );
    }
  }

  private async sendDirectBotMessage(
    channel: AdminMessageChannel,
    tokenKey: 'TELEGRAM_BOT_TOKEN' | 'BALE_BOT_TOKEN',
    baseUrl: string,
    chatId: string,
    message: string,
  ): Promise<void> {
    const token = this.config.get<string>(tokenKey)?.trim();
    if (!token) throw new Error(`${tokenKey} is not configured.`);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const diagnostic = this.networkError(error);
      const relayHint =
        channel === AdminMessageChannel.TELEGRAM
          ? ' Configure TELEGRAM_RELAY_URL and TELEGRAM_RELAY_SECRET when direct access is blocked.'
          : '';
      throw new Error(
        `${channel} request failed before an API response: ${diagnostic}.${relayHint}`,
      );
    }

    const payload = await this.readResponse(response);
    if (!response.ok || payload?.ok !== true) {
      throw new Error(
        `${channel} rejected the message: ${this.failureDescription(payload, response)}`,
      );
    }
  }

  private failureDescription(payload: BotApiResponse | null, response: Response): string {
    const code = payload?.code?.slice(0, 100);
    const description = payload?.description?.slice(0, 300);
    const retryAfter = Number.isSafeInteger(payload?.retryAfterSeconds)
      ? `; retry after ${payload?.retryAfterSeconds} seconds`
      : '';
    if (code && description) return `${code}: ${description}${retryAfter}`;
    if (code) return `${code}${retryAfter}`;
    if (description) return `${description}${retryAfter}`;
    return `HTTP ${response.status}`;
  }

  private async readResponse(response: Response): Promise<BotApiResponse | null> {
    try {
      const payload: unknown = await response.json();
      return typeof payload === 'object' && payload !== null ? (payload as BotApiResponse) : null;
    } catch {
      return null;
    }
  }

  private networkError(error: unknown): string {
    if (!(error instanceof Error)) return String(error);
    const cause = error.cause;
    if (!cause || typeof cause !== 'object') return error.message;
    const source = cause as { code?: unknown; message?: unknown };
    const code = typeof source.code === 'string' ? source.code : null;
    const message = typeof source.message === 'string' ? source.message : null;
    if (code && message) return `${error.message}; ${code}: ${message}`;
    if (code) return `${error.message}; ${code}`;
    if (message) return `${error.message}; ${message}`;
    return error.message;
  }
}
