
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AdminMessageChannel } from '../../generated/prisma/enums';

type BotApiResponse = Readonly<{
  ok?: boolean;
  code?: string;
  description?: string;
  retryAfterSeconds?: number;
}>;

const TELEGRAM_MAX_CAPTION_LENGTH = 1024;

export type AdminMessageSendOptions = Readonly<{
  imageUrl?: string;
}>;

function splitPhotoMessage(message: string): readonly [string, string | null] {
  if (message.length <= TELEGRAM_MAX_CAPTION_LENGTH) {
    return [message, null];
  }

  const preferredBreak = message.lastIndexOf('\n', TELEGRAM_MAX_CAPTION_LENGTH);
  const breakAt =
    preferredBreak >= 200
      ? preferredBreak
      : TELEGRAM_MAX_CAPTION_LENGTH;

  return [message.slice(0, breakAt), message.slice(breakAt) || null];
}

@Injectable()
export class AdminMessageSender {
  private readonly timeoutMs: number;
  private readonly telegramRelayUrl: string | undefined;
  private readonly telegramRelaySecret: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.timeoutMs = this.config.get<number>(
      'ADMIN_MESSAGING_REQUEST_TIMEOUT_MS',
      8000,
    );

    this.telegramRelayUrl =
      this.config.get<string>('TELEGRAM_RELAY_URL')?.trim() || undefined;

    this.telegramRelaySecret =
      this.config.get<string>('TELEGRAM_RELAY_SECRET')?.trim() || undefined;
  }

  async send(
    channel: AdminMessageChannel,
    chatId: string,
    message: string,
    optionsOrImageUrl: AdminMessageSendOptions | string | null = {},
  ): Promise<void> {
    const imageUrl =
      typeof optionsOrImageUrl === 'string' || optionsOrImageUrl === null
        ? optionsOrImageUrl
        : optionsOrImageUrl.imageUrl;

    const safeImageUrl = this.safeImageUrl(imageUrl);

    const [firstMessage, remainingMessage] =
      safeImageUrl && channel === AdminMessageChannel.TELEGRAM
        ? splitPhotoMessage(message)
        : ([message, null] as const);

    if (channel === AdminMessageChannel.TELEGRAM) {
      if (this.telegramRelayUrl || this.telegramRelaySecret) {
        await this.sendTelegramThroughRelay(
          chatId,
          firstMessage,
          safeImageUrl,
        );

        if (remainingMessage) {
          await this.sendTelegramThroughRelay(
            chatId,
            remainingMessage,
          );
        }
      } else {
        await this.sendDirectBotMessage(
          channel,
          'TELEGRAM_BOT_TOKEN',
          'https://api.telegram.org',
          chatId,
          firstMessage,
          safeImageUrl,
        );

        if (remainingMessage) {
          await this.sendDirectBotMessage(
            channel,
            'TELEGRAM_BOT_TOKEN',
            'https://api.telegram.org',
            chatId,
            remainingMessage,
          );
        }
      }

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

  private async sendTelegramThroughRelay(
    chatId: string,
    message: string,
    imageUrl?: string,
  ): Promise<void> {
    if (!this.telegramRelayUrl || !this.telegramRelaySecret) {
      throw new Error(
        'TELEGRAM_RELAY_URL and TELEGRAM_RELAY_SECRET must be configured together.',
      );
    }

    let response: Response;

    try {
      response = await fetch(this.telegramRelayUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.telegramRelaySecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          message,
          ...(imageUrl ? { imageUrl } : {}),
        }),
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
    imageUrl?: string,
  ): Promise<void> {
    const token = this.config.get<string>(tokenKey)?.trim();

    if (!token) {
      throw new Error(`${tokenKey} is not configured.`);
    }

    if (channel === AdminMessageChannel.TELEGRAM && imageUrl) {
      await this.sendDirectBotRequest(
        channel,
        token,
        baseUrl,
        'sendPhoto',
        {
          chat_id: chatId,
          photo: imageUrl,
          ...(message.length <= TELEGRAM_MAX_CAPTION_LENGTH
            ? { caption: message }
            : {}),
        },
      );

      if (message.length > TELEGRAM_MAX_CAPTION_LENGTH) {
        await this.sendDirectBotRequest(
          channel,
          token,
          baseUrl,
          'sendMessage',
          {
            chat_id: chatId,
            text: message,
          },
        );
      }

      return;
    }

    await this.sendDirectBotRequest(
      channel,
      token,
      baseUrl,
      'sendMessage',
      {
        chat_id: chatId,
        text: message,
      },
    );
  }

  private async sendDirectBotRequest(
    channel: AdminMessageChannel,
    token: string,
    baseUrl: string,
    method: 'sendMessage' | 'sendPhoto',
    body: Readonly<Record<string, string>>,
  ): Promise<void> {
    let response: Response;

    try {
      response = await fetch(`${baseUrl}/bot${token}/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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

  private failureDescription(
    payload: BotApiResponse | null,
    response: Response,
  ): string {
    const code = payload?.code?.slice(0, 100);
    const description = payload?.description?.slice(0, 300);

    const retryAfter = Number.isSafeInteger(payload?.retryAfterSeconds)
      ? `; retry after ${payload?.retryAfterSeconds} seconds`
      : '';

    if (code && description) {
      return `${code}: ${description}${retryAfter}`;
    }

    if (code) {
      return `${code}${retryAfter}`;
    }

    if (description) {
      return `${description}${retryAfter}`;
    }

    return `HTTP ${response.status}`;
  }

  private async readResponse(
    response: Response,
  ): Promise<BotApiResponse | null> {
    try {
      const payload: unknown = await response.json();

      return typeof payload === 'object' && payload !== null
        ? (payload as BotApiResponse)
        : null;
    } catch {
      return null;
    }
  }

  private networkError(error: unknown): string {
    if (!(error instanceof Error)) {
      return String(error);
    }

    const cause = error.cause;

    if (!cause || typeof cause !== 'object') {
      return error.message;
    }

    const source = cause as {
      code?: unknown;
      message?: unknown;
    };

    const code =
      typeof source.code === 'string' ? source.code : null;

    const message =
      typeof source.message === 'string' ? source.message : null;

    if (code && message) {
      return `${error.message}; ${code}: ${message}`;
    }

    if (code) {
      return `${error.message}; ${code}`;
    }

    if (message) {
      return `${error.message}; ${message}`;
    }

    return error.message;
  }

  private safeImageUrl(
    value: string | null | undefined,
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    try {
      const url = new URL(value);

      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password
      ) {
        return undefined;
      }

      return url.toString();
    } catch {
      return undefined;
    }
  }
}
