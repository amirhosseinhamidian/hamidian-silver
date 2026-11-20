import { setTimeout as delay } from 'node:timers/promises';
import { SearchConsoleError, searchConsoleRecord } from './search-console-errors';

const maximumInFlight = 4;
const timeoutMs = 5000;
const maximumAttempts = 3;
const quotaReasons = new Set(['quotaExceeded', 'dailyLimitExceeded', 'servingLimitExceeded']);
const throttleReasons = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'rateLimitExceededUnreg',
]);
const oauthAccountErrors = new Set([
  'invalid_client',
  'unauthorized_client',
  'disabled_client',
  'deleted_client',
]);

function oauthClientError(body: unknown): SearchConsoleError {
  const error = searchConsoleRecord(body);
  if (error?.error === 'invalid_grant') {
    const description = typeof error.error_description === 'string' ? error.error_description : '';
    if (/short-lived token|reasonable timeframe|clock skew/i.test(description)) {
      return new SearchConsoleError(
        'authentication_failed',
        undefined,
        'Google OAuth rejected the JWT timestamps. Check the local system clock.',
      );
    }
    if (/invalid jwt signature/i.test(description)) {
      return new SearchConsoleError(
        'authentication_failed',
        undefined,
        'Google OAuth rejected the JWT signature. Check that the JSON key is active and belongs to the service account.',
      );
    }
    return new SearchConsoleError(
      'authentication_failed',
      undefined,
      'Google OAuth rejected the service account assertion (invalid_grant).',
    );
  }
  if (typeof error?.error === 'string' && oauthAccountErrors.has(error.error)) {
    return new SearchConsoleError(
      'authentication_failed',
      undefined,
      'Google OAuth rejected the service account client. Check that the account and its key are active.',
    );
  }
  return new SearchConsoleError(
    'invalid_response',
    undefined,
    'The Google OAuth endpoint returned an unexpected error during token exchange.',
  );
}

function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - Date.now()) / 1000;
  return Number.isSafeInteger(Math.ceil(seconds)) ? Math.max(0, Math.ceil(seconds)) : undefined;
}

function googleError(
  status: number,
  body: unknown,
  stage: 'search_console' | 'oauth',
  retryAfter?: number,
): SearchConsoleError {
  const detail = searchConsoleRecord(searchConsoleRecord(body)?.error);
  const reasons = Array.isArray(detail?.errors)
    ? detail.errors.map((entry) => searchConsoleRecord(entry)?.reason)
    : [];
  if (reasons.some((reason) => typeof reason === 'string' && quotaReasons.has(reason))) {
    return new SearchConsoleError('quota_exceeded', retryAfter);
  }
  if (
    status === 429 ||
    (status === 403 &&
      reasons.some((reason) => typeof reason === 'string' && throttleReasons.has(reason)))
  ) {
    return new SearchConsoleError('rate_limited', retryAfter);
  }
  if (stage === 'oauth' && status >= 400 && status < 500) return oauthClientError(body);
  if (status === 400) return new SearchConsoleError('invalid_query');
  if (status === 401) return new SearchConsoleError('authentication_failed');
  if (status === 403) return new SearchConsoleError('access_denied');
  if (status === 404) return new SearchConsoleError('property_not_found');
  return new SearchConsoleError('upstream_unavailable', retryAfter);
}

export class SearchConsoleTransport {
  private active = 0;
  private rateLimitedUntil = 0;

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async json(
    url: string,
    init: RequestInit,
    stage: 'search_console' | 'oauth' = 'search_console',
  ): Promise<unknown> {
    const remainingSeconds = Math.ceil((this.rateLimitedUntil - Date.now()) / 1000);
    if (remainingSeconds > 0) throw new SearchConsoleError('rate_limited', remainingSeconds);
    if (this.active >= maximumInFlight) throw new SearchConsoleError('busy', 1);
    this.active++;
    try {
      for (let attempt = 0; ; attempt++) {
        const signal = AbortSignal.timeout(timeoutMs);
        let failure: SearchConsoleError;
        let retryable = true;
        try {
          const response = await this.fetcher(url, { ...init, signal, redirect: 'error' });
          let body: unknown;
          try {
            body = await response.json();
          } catch (error) {
            if (signal.aborted) throw error;
            if (response.ok) throw new SearchConsoleError('invalid_response');
          }
          if (response.ok) return body;
          failure = googleError(
            response.status,
            body,
            stage,
            retryAfterSeconds(response.headers.get('Retry-After')),
          );
          retryable =
            failure.code === 'rate_limited' || (response.status >= 500 && response.status <= 599);
        } catch (error) {
          if (error instanceof SearchConsoleError) throw error;
          failure = new SearchConsoleError(signal.aborted ? 'timeout' : 'upstream_unavailable');
        }

        const retryAfter = failure.retryAfterSeconds;
        if (failure.code === 'rate_limited') {
          this.rateLimitedUntil = Math.max(
            this.rateLimitedUntil,
            Date.now() + (retryAfter ?? 1) * 1000,
          );
        }
        if (!retryable || attempt + 1 >= maximumAttempts || (retryAfter ?? 0) > 2) throw failure;
        await delay(
          Math.max((retryAfter ?? 0) * 1000, 250 * 2 ** attempt + Math.floor(Math.random() * 125)),
        );
      }
    } finally {
      this.active--;
    }
  }
}
