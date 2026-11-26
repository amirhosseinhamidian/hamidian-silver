import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PERMISSIONS_KEY } from '../../authorization/permissions.decorator';
import { PERMISSION_CODES } from '../../authorization/rbac.constants';
import {
  GoogleSearchConsoleClient,
  type SearchConsoleClient,
} from './google-search-console.client';
import { SearchConsoleController } from './search-console.controller';
import { SearchConsoleError } from './search-console-errors';
import { SearchConsoleService } from './search-console.service';
import { SearchConsoleTransport } from './search-console-transport';

const property = 'sc-domain:hamidian.shop';
const period = { startDate: '2026-11-01', endDate: '2026-11-07' };
const upstreamMetrics = { clicks: 3, impressions: 15, ctr: 0.2, position: 2.5 };

function fixture() {
  const client = {
    property,
    checkAccess: jest.fn<Promise<void>, []>(),
    query: jest.fn<Promise<unknown>, Parameters<SearchConsoleClient['query']>>(),
    listSitemaps: jest.fn<Promise<unknown>, []>(),
  };
  return { client, service: new SearchConsoleService(client) };
}

it('protects all Search Console endpoints with settings.read', () => {
  const controller = SearchConsoleController.prototype;
  for (const handler of [
    controller.connection,
    controller.performance,
    controller.brandPerformance,
    controller.sitemaps,
  ]) {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([PERMISSION_CODES.SETTINGS_READ]);
  }
});

it('keeps an invalid property setting out of the connection response', async () => {
  const client = new GoogleSearchConsoleClient({ property: 'invalid-configuration-value' });
  await expect(new SearchConsoleService(client).connection()).resolves.toMatchObject({
    property: '',
    status: 'unavailable',
    reason: 'property_not_found',
  });
});

it('preserves Google metric units, aggregation and the next row offset', async () => {
  const { service, client } = fixture();
  client.query.mockResolvedValueOnce({
    responseAggregationType: 'byPage',
    rows: [{ ...upstreamMetrics, keys: ['https://hamidian.shop/products', 'MOBILE'] }],
  });
  await expect(
    service.performance({
      ...period,
      dimensions: ['page', 'device'],
      rowLimit: 1,
      startRow: 5,
      filters: [{ dimension: 'device', operator: 'equals', expression: 'mobile' }],
    }),
  ).resolves.toMatchObject({
    scope: 'grouped_rows',
    aggregation: 'byPage',
    nextStartRow: 6,
    rows: [{ ctr: 0.2, averagePosition: 2.5 }],
  });
  expect(client.query).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'web',
      dataState: 'final',
      startRow: 5,
      aggregationType: 'auto',
      dimensionFilterGroups: [
        {
          groupType: 'and',
          filters: [{ dimension: 'device', operator: 'equals', expression: 'MOBILE' }],
        },
      ],
    }),
  );
  await expect(
    service.performance({ ...period, dimensions: ['page'], aggregation: 'byProperty' }),
  ).rejects.toThrow('automatic');
  await expect(service.performance({ ...period, endDate: '2026-11-31' })).rejects.toThrow(
    'valid Search Console period',
  );
  client.query.mockResolvedValueOnce({});
  await expect(service.performance(period)).resolves.toMatchObject({
    scope: 'property_total',
    rows: [],
    nextStartRow: null,
  });
});

it('keeps an omitted average position empty and identifies page totals', async () => {
  const { service, client } = fixture();
  client.query.mockResolvedValueOnce({
    responseAggregationType: 'byPage',
    rows: [{ clicks: 2, impressions: 5, ctr: 0.4 }],
  });
  await expect(
    service.performance({ ...period, searchType: 'discover', rowLimit: 1 }),
  ).resolves.toMatchObject({
    scope: 'page_total',
    nextStartRow: null,
    rows: [{ averagePosition: null }],
  });
});

it('uses native brand classification and falls back only when the feature is unavailable', async () => {
  const { service, client } = fixture();
  client.query.mockResolvedValueOnce({ rows: [{ ...upstreamMetrics, keys: ['BRANDED'] }] });
  await expect(service.brandPerformance(period)).resolves.toMatchObject({
    classification: 'google',
    branded: { clicks: 3 },
    nonBranded: null,
  });
  expect(client.query).toHaveBeenCalledWith(
    expect.objectContaining({ dimensions: ['brandedClassification'] }),
  );
  client.query
    .mockRejectedValueOnce(new SearchConsoleError('invalid_query'))
    .mockResolvedValueOnce({ rows: [upstreamMetrics] })
    .mockResolvedValueOnce({});
  await expect(service.brandPerformance(period)).resolves.toMatchObject({
    classification: 'estimated',
    branded: { clicks: 3 },
    nonBranded: null,
  });
  expect(client.query.mock.calls[2]?.[0].dimensionFilterGroups?.[0].filters[0].operator).toBe(
    'includingRegex',
  );
  expect(client.query.mock.calls[3]?.[0].dimensionFilterGroups?.[0].filters[0].operator).toBe(
    'excludingRegex',
  );
  client.query.mockRejectedValueOnce(new SearchConsoleError('access_denied'));
  await expect(service.brandPerformance(period)).rejects.toMatchObject({ code: 'access_denied' });
  expect(client.query).toHaveBeenCalledTimes(5);
});

it('projects sitemap metadata and keeps diagnostic errors free of the upstream response', async () => {
  const { service, client } = fixture();
  client.listSitemaps.mockResolvedValueOnce({
    sitemap: [
      {
        path: 'https://hamidian.shop/sitemap.xml?extra=sensitive',
        lastSubmitted: '2026-11-02T10:01:00Z',
        errors: '1',
        contents: [{ type: 'web', submitted: '12', indexed: '11' }],
      },
    ],
  });
  await expect(service.sitemaps()).resolves.toMatchObject({
    items: [
      {
        path: 'https://hamidian.shop/sitemap.xml',
        errors: 1,
        warnings: null,
        contents: [{ type: 'web', submitted: 12 }],
      },
    ],
  });
  client.checkAccess.mockRejectedValueOnce(new SearchConsoleError('access_denied'));
  await expect(service.connection()).resolves.toMatchObject({
    status: 'unavailable',
    reason: 'access_denied',
  });
  const attempt = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(
      Response.json(
        { error: { message: 'raw secret' } },
        { status: 429, headers: { 'Retry-After': '35' } },
      ),
    );
  const transport = new SearchConsoleTransport(attempt);
  await expect(transport.json('https://www.googleapis.com/test', {})).rejects.toMatchObject({
    code: 'rate_limited',
    retryAfterSeconds: 35,
  });
  await expect(transport.json('https://www.googleapis.com/test', {})).rejects.not.toThrow(
    'raw secret',
  );
  expect(attempt).toHaveBeenCalledTimes(1);
});

it.each([
  {
    description: 'Invalid JWT: Token must be a short-lived token and in a reasonable timeframe.',
    message: 'Google OAuth rejected the JWT timestamps. Check the local system clock.',
  },
  {
    description: 'Invalid JWT Signature.',
    message:
      'Google OAuth rejected the JWT signature. Check that the JSON key is active and belongs to the service account.',
  },
  {
    description: 'Unexpected rejection.',
    message: 'Google OAuth rejected the service account assertion (invalid_grant).',
  },
])('reports a safe OAuth message for $description', async ({ description, message }) => {
  const attempt = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(
      Response.json(
        { error: 'invalid_grant', error_description: `${description} sensitive upstream details` },
        { status: 400 },
      ),
    );
  const transport = new SearchConsoleTransport(attempt);

  await expect(
    transport.json('https://oauth2.googleapis.com/token', { method: 'POST' }, 'oauth'),
  ).rejects.toMatchObject({ code: 'authentication_failed', message });
  expect(attempt).toHaveBeenCalledTimes(1);
});

it('distinguishes an unreadable credential path from malformed JSON before calling Google', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gsc-invalid-fixture-'));
  try {
    const file = join(directory, 'account.json');
    const attempt = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    const client = new GoogleSearchConsoleClient(
      { credentialsFile: file },
      new SearchConsoleTransport(attempt),
    );

    await expect(client.checkAccess()).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: 'The configured service account JSON file was not found (ENOENT).',
    });
    await writeFile(file, '{"private_key":"fixture"', { mode: 0o600 });
    await expect(client.checkAccess()).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: 'The service account file contains malformed JSON.',
    });
    expect(attempt).not.toHaveBeenCalled();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('signs a read-only assertion, reuses the token and refreshes once after a 401', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gsc-fixture-'));
  try {
    const file = join(directory, 'account.json');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    await writeFile(
      file,
      JSON.stringify({
        type: 'service_account',
        client_email: 'fixture@tests.iam.gserviceaccount.com',
        private_key_id: 'fixture',
        private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        token_uri: 'https://untrusted.example/ignored',
      }),
      { mode: 0o600 },
    );
    const attempt = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(Response.json({ access_token: 'old-token', expires_in: 3600 }))
      .mockResolvedValueOnce(
        Response.json({ siteUrl: property, permissionLevel: 'siteRestrictedUser' }),
      )
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ access_token: 'new-token', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ sitemap: [] }))
      .mockResolvedValueOnce(
        Response.json({ inspectionResult: { indexStatusResult: { verdict: 'PASS' } } }),
      );
    const client = new GoogleSearchConsoleClient(
      { credentialsFile: file },
      new SearchConsoleTransport(attempt),
    );
    await expect(client.checkAccess()).resolves.toBeUndefined();
    await expect(client.listSitemaps()).resolves.toEqual({ sitemap: [] });
    expect(attempt).toHaveBeenCalledTimes(5);
    await expect(client.inspect('https://hamidian.shop/products')).resolves.toMatchObject({
      inspectionResult: { indexStatusResult: { verdict: 'PASS' } },
    });
    expect(attempt).toHaveBeenCalledTimes(6);
    expect(attempt).toHaveBeenNthCalledWith(
      6,
      'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        headers: { Authorization: 'Bearer new-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionUrl: 'https://hamidian.shop/products',
          siteUrl: property,
          languageCode: 'en-US',
        }),
      }),
    );
    const [url, init] = attempt.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init?.redirect).toBe('error');
    const assertion = (init?.body as URLSearchParams).get('assertion')!;
    const [header, payload, signature] = assertion.split('.');
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toMatchObject({
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: url,
    });
    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(`${header}.${payload}`),
        publicKey,
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
    expect(attempt.mock.calls[4][1]?.headers).toEqual({ Authorization: 'Bearer new-token' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
