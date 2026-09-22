import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AdminMessageChannel } from '../../generated/prisma/enums';

type BotApiResponse = Readonly<{ ok?: boolean; description?: string }>;

@Injectable()
export class AdminMessageSender {
  private readonly timeoutMs: number;
  private readonly telegramBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.timeoutMs = this.config.get<number>('ADMIN_MESSAGING_REQUEST_TIMEOUT_MS', 8000);
    this.telegramBaseUrl = (
      this.config.get<string>('TELEGRAM_BOT_API_BASE_URL')?.trim() || 'https://api.telegram.org'
    ).replace(/\/+$/, '');
  }

  async send(channel: AdminMessageChannel, chatId: string, message: string): Promise<void> {
    const tokenKey =
      channel === AdminMessageChannel.TELEGRAM ? 'TELEGRAM_BOT_TOKEN' : 'BALE_BOT_TOKEN';
    const token = this.config.get<string>(tokenKey)?.trim();
    if (!token) throw new Error(`${tokenKey} is not configured.`);

    const baseUrl =
      channel === AdminMessageChannel.TELEGRAM ? this.telegramBaseUrl : 'https://tapi.bale.ai';
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
          ? ' Check outbound DNS/HTTPS or configure TELEGRAM_BOT_API_BASE_URL.'
          : '';
      throw new Error(
        `${channel} request failed before an API response: ${diagnostic}.${relayHint}`,
      );
    }

    const payload = await this.readResponse(response);
    if (!response.ok || payload?.ok !== true) {
      const description = payload?.description?.slice(0, 300) || `HTTP ${response.status}`;
      throw new Error(`${channel} rejected the message: ${description}`);
    }
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
