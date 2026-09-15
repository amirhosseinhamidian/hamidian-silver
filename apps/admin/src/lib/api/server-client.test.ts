import { describe, expect, it, vi } from 'vitest';

import { createServerApiClient, normalizeApiOrigin } from './server-client';

describe('server API client', () => {
  it('uses generated API paths and forwards bearer sessions', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const client = createServerApiClient({
      apiOrigin: 'https://api.hamidian.test/',
      accessToken: 'opaque-session-token',
      fetch: fetchMock,
    });

    await client.GET('/api/v1/auth/me');

    expect(fetchMock).toHaveBeenCalledOnce();

    const request = fetchMock.mock.calls[0]?.[0];

    expect(request).toBeInstanceOf(Request);

    if (!(request instanceof Request)) {
      throw new TypeError('Expected openapi-fetch to call fetch with a Request.');
    }

    expect(request.url).toBe('https://api.hamidian.test/api/v1/auth/me');
    expect(request.headers.get('authorization')).toBe('Bearer opaque-session-token');
  });

  it('accepts only an HTTP(S) API origin without a path', () => {
    expect(normalizeApiOrigin('http://localhost:3001/')).toBe('http://localhost:3001');
    expect(() => normalizeApiOrigin('https://api.hamidian.test/api')).toThrow(
      'API origin must not include credentials, a path, query, or fragment.',
    );
    expect(() => normalizeApiOrigin('ftp://api.hamidian.test')).toThrow(
      'API origin must use HTTP or HTTPS.',
    );
  });
});
