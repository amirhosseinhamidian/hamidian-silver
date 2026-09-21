import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AdminMessageChannel } from '../../generated/prisma/enums';

type BotApiResponse = Readonly<{ ok?: boolean; description?: string }>;

@Injectable()
export class AdminMessageSender {
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.timeoutMs = this.config.get<number>('ADMIN_MESSAGING_REQUEST_TIMEOUT_MS', 8000);
  }

  async send(channel: AdminMessageChannel, chatId: string, message: string): Promise<void> {
    const tokenKey =
      channel === AdminMessageChannel.TELEGRAM ? 'TELEGRAM_BOT_TOKEN' : 'BALE_BOT_TOKEN';
    const token = this.config.get<string>(tokenKey)?.trim();
    if (!token) throw new Error(`${tokenKey} is not configured.`);

    const baseUrl =
      channel === AdminMessageChannel.TELEGRAM
        ? 'https://api.telegram.org'
        : 'https://tapi.bale.ai';
    const response = await fetch(`${baseUrl}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

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
}
