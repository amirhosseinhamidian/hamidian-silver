import { crc32, deflateRawSync } from 'node:zlib';
import { emptyObservation } from '../audit/seo-audit-crawl';
import { SearchConsoleTransport } from '../search-console/search-console-transport';
import { parseCoverageUpload } from './seo-coverage-import';
import {
  compareIndexEvidence,
  inspectionPath,
  inspectionScope,
  readGoogleIndex,
} from './seo-index-observation';

const origin = 'https://hamidian.shop';
const url = `${origin}/products/ring`;

function tableZip(csv: Buffer) {
  const name = Buffer.from('Table.csv');
  const data = deflateRawSync(csv);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(name.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt16LE(8, 10);
  directory.writeUInt32LE(crc32(csv), 16);
  directory.writeUInt32LE(data.length, 20);
  directory.writeUInt32LE(csv.length, 24);
  directory.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + data.length, 16);
  return Buffer.concat([local, name, data, directory, name, end]);
}

it('scopes inspected URLs and preserves recorded Google evidence', () => {
  expect(inspectionScope('sc-domain:hamidian.shop', origin)).toBe(origin);
  expect(inspectionScope('sc-domain:hamidian.shop', 'https://otherhamidian.shop')).toBeNull();
  expect(inspectionScope('https://hamidian.shop/', 'https://www.hamidian.shop')).toBeNull();
  expect(inspectionPath(origin, `${url}?sort=price-asc`)).toBeNull();
  expect(inspectionPath(origin, '/products?page=12')).toBe('/products?page=12');
  const index = readGoogleIndex({
    inspectionResult: {
      indexStatusResult: {
        verdict: 'NEUTRAL',
        coverageState: 'Discovered - currently not indexed',
        lastCrawlTime: '2026-11-21T12:00:00Z',
        googleCanonical: `${origin}/products/preferred`,
      },
    },
  });
  expect(index).toMatchObject({
    verdict: 'NEUTRAL',
    lastCrawlAt: '2026-11-21T12:00:00.000Z',
    indexingState: null,
  });
  const local = {
    ...emptyObservation('/products/ring'),
    html: true,
    status: 200,
    canonicals: [url],
  };
  expect(compareIndexEvidence(url, index, local, null)).toEqual([
    'GOOGLE_COVERAGE_HTTP_200',
    'GOOGLE_CANONICAL_DIFFERS',
  ]);
  expect(compareIndexEvidence(url, index, { ...local, failure: 'NETWORK' }, true)).toEqual([]);
  expect(readGoogleIndex({ inspectionResult: {} })).toMatchObject({
    verdict: null,
    lastCrawlAt: null,
  });
  expect(() => readGoogleIndex({ other: {} })).toThrow('unexpected');
});

it('passes quota back to the durable worker after a single inspection request', async () => {
  const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        error: { errors: [{ reason: 'dailyLimitExceeded' }] },
      }),
      { status: 403, headers: { 'Retry-After': '120' } },
    ),
  );
  const transport = new SearchConsoleTransport(fetcher);
  await expect(
    transport.json(
      'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      {},
      'inspection',
    ),
  ).rejects.toMatchObject({ code: 'quota_exceeded', retryAfterSeconds: 120 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('validates Coverage summaries and Drilldown CSV or ZIP with bounded data', () => {
  const csv = Buffer.from(`URL,Last crawled\r\n${url},"Nov 20, 2026"\r\n`);
  const expected = [
    { url, reason: 'Discovered', lastCrawled: '2026-11-20', pages: null, validation: null },
  ];
  expect(parseCoverageUpload(csv, origin, 'Discovered')).toEqual(expected);
  expect(parseCoverageUpload(tableZip(csv), origin, 'Discovered')).toEqual(expected);
  expect(
    parseCoverageUpload(
      Buffer.from('Reason,Source,Validation,Pages\n"Crawled, not indexed",Google,Started,"1,240"'),
      origin,
      'Coverage',
    ),
  ).toEqual([
    {
      reason: 'Crawled, not indexed',
      url: null,
      lastCrawled: null,
      pages: 1240,
      validation: 'Started',
    },
  ]);
  expect(() =>
    parseCoverageUpload(
      Buffer.from('URL,Last crawled\nhttps://other.shop/products/ring,2026-11-20'),
      origin,
      'Coverage',
    ),
  ).toThrow();
  expect(() =>
    parseCoverageUpload(Buffer.from(`URL,Last crawled\n${url},2026-02-30`), origin, 'Coverage'),
  ).toThrow();
  expect(() => parseCoverageUpload(tableZip(csv).subarray(0, -2), origin, 'Coverage')).toThrow();
});
