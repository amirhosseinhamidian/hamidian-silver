export const SEARCH_CONSOLE_ERROR_CODES = [
  'not_configured',
  'invalid_credentials',
  'authentication_failed',
  'access_denied',
  'property_not_found',
  'quota_exceeded',
  'rate_limited',
  'busy',
  'invalid_query',
  'timeout',
  'upstream_unavailable',
  'invalid_response',
] as const;

export type SearchConsoleErrorCode = (typeof SEARCH_CONSOLE_ERROR_CODES)[number];

const messages: Record<SearchConsoleErrorCode, string> = {
  not_configured: 'Search Console credentials are not configured on this server.',
  invalid_credentials: 'Cannot read or use the local service account JSON file.',
  authentication_failed: 'Google rejected the service account authentication.',
  access_denied: 'Check the Search Console property permissions and API activation.',
  property_not_found: 'Check the exact Search Console property identifier.',
  quota_exceeded: 'Google Search Console quota was exceeded.',
  rate_limited: 'Google Search Console requests are temporarily rate limited.',
  busy: 'The server has reached its Search Console request limit.',
  invalid_query:
    'Google rejected the Search Console query or this feature is unavailable for the property.',
  timeout: 'Google Search Console did not respond in time.',
  upstream_unavailable: 'Google Search Console is temporarily unavailable.',
  invalid_response: 'Google returned an unexpected Search Console response.',
};

export class SearchConsoleError extends Error {
  constructor(
    readonly code: SearchConsoleErrorCode,
    readonly retryAfterSeconds?: number,
    message = messages[code],
  ) {
    super(message);
    this.name = 'SearchConsoleError';
  }
}

export function searchConsoleRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
