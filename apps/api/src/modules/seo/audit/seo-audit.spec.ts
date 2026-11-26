import {
  auditOrigin,
  auditPath,
  createAuditCrawler,
  emptyObservation,
  parseSitemapPaths,
  readAuditHtml,
} from './seo-audit-crawl';
import { auditMetadataKey, evaluateAudit, hasAuditNoindex } from './seo-audit-rules';

const origin = 'https://store.example';
const path = '/products/ring';
const context = {
  origin,
  path,
  source: 'PRODUCT',
  sourcePath: '/products',
  expectedCanonical: path,
  mustNoIndex: false,
  inSitemap: true,
  productStock: true,
};

describe('technical SEO crawl', () => {
  it('bounds discovered paths to the public catalog and permitted URL variants', () => {
    expect(auditOrigin(`${origin}/`)).toBe(origin);
    expect(auditOrigin(`${origin}/anything`)).toBeNull();
    expect(auditPath(origin, '../products/ring#size', `${origin}/categories/silver`)).toBe(path);
    expect(auditPath(origin, '/products?page=2')).toBe('/products?page=2');
    expect(auditPath(origin, '/products?sort=price-asc')).toBe('/products?sort=price-asc');
    for (const url of [
      'https://elsewhere.example/products/ring',
      'https://someone@store.example/products/ring',
      '/products%2Fring',
      '/api/search',
      '/account',
      '/products?unknown=token',
    ])
      expect(auditPath(origin, url)).toBeNull();
    expect(
      parseSitemapPaths(
        origin,
        '<urlset><url><loc>https://store.example/products/ring</loc></url></urlset>',
      ),
    ).toEqual([path]);
    expect(parseSitemapPaths(origin, '<sitemapindex></sitemapindex>')).toBeNull();
  });

  it('observes actual metadata, typed JSON-LD and anchors without executing scripts', () => {
    const observation = { ...emptyObservation(path), status: 200 };
    readAuditHtml(
      origin,
      observation,
      `
      <title>نقره &amp; طلا</title><meta content="نگین" name="Description">
      <link href="/products/ring" rel="alternate canonical">
      <meta content="noindex, follow" name="googlebot">
      <script type="application/ld+json">{"@graph":[{"@type":"Product","offers":{"@type":"Offer"}},{"@type":"BreadcrumbList"}]}</script>
      <script type="application/ld+json">{broken}</script>
      <script>const x = '<a href="/products/fake">fake</a>';</script>
      <a href="../products/real">real</a><a href="/products/skipped" rel="nofollow">skip</a>
    `,
    );
    expect(observation).toMatchObject({
      title: 'نقره & طلا',
      description: 'نگین',
      canonicals: [`${origin}${path}`],
      robots: ['googlebot: noindex, follow'],
      schema: ['BreadcrumbList', 'Offer', 'Product'],
      links: ['/products/real'],
      malformedSchema: true,
      html: true,
    });
    expect(evaluateAudit(context, observation).map(({ code }) => code)).toEqual([
      'SITEMAP_NOINDEX',
      'INVALID_JSON_LD',
    ]);
    expect(auditMetadataKey(observation)).toBeNull();
    expect(hasAuditNoindex(['bingbot: noindex, follow'])).toBe(false);
    expect(hasAuditNoindex(['Googlebot: none'])).toBe(true);
  });

  it('paces requests between redirects and never requests an off-origin destination', async () => {
    const request = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { Location: '/products/new' } }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: 'https://elsewhere.example/products/new' },
        }),
      );
    const wait = jest.fn(async () => undefined);
    await expect(createAuditCrawler(origin, request, wait)(path)).resolves.toMatchObject({
      observation: {
        failure: 'REDIRECT_SCOPE',
        status: 302,
        finalPath: '/products/new',
        redirects: [
          { status: 301, to: '/products/new' },
          { status: 302, to: null },
        ],
      },
    });
    expect(request.mock.calls.map(([url]) => String(url))).toEqual([
      `${origin}${path}`,
      `${origin}/products/new`,
    ]);
    expect(wait.mock.calls).toHaveLength(2);
    expect(wait).toHaveBeenNthCalledWith(1, 0);
    expect(wait).toHaveBeenNthCalledWith(2, expect.any(Number));
    expect(request).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('distinguishes verified 404 conflicts from network failures and allowed canonical overrides', () => {
    const missing = { ...emptyObservation(path), status: 404 };
    expect(evaluateAudit(context, missing).map(({ code }) => code)).toEqual([
      'BROKEN_INTERNAL_LINK',
      'SITEMAP_NOT_FOUND',
      'BUYABLE_PRODUCT_NOT_FOUND',
    ]);
    expect(
      evaluateAudit(context, { ...missing, failure: 'NETWORK' }).map(({ code }) => code),
    ).toEqual(['CRAWL_UNVERIFIED']);
    const html = { ...emptyObservation(path), status: 200 };
    const preferred = '/products/preferred';
    readAuditHtml(
      origin,
      html,
      `<title>حلقه</title><meta name="description" content="نقره"><link rel="canonical" href="${preferred}">`,
    );
    expect(
      evaluateAudit({ ...context, expectedCanonical: preferred, inSitemap: false }, html),
    ).toEqual([]);
    expect(evaluateAudit({ ...context, expectedCanonical: preferred }, html)).toEqual([
      { code: 'SITEMAP_NONCANONICAL', severity: 'ERROR', evidence: [`${origin}${preferred}`] },
    ]);
    expect(evaluateAudit({ ...context, inSitemap: false, mustNoIndex: true }, html)).toEqual([
      { code: 'EXPECTED_NOINDEX_MISSING', severity: 'ERROR', evidence: ['robots: —'] },
      {
        code: 'UNEXPECTED_CANONICAL',
        severity: 'REVIEW',
        evidence: [`${origin}${preferred}`, path],
      },
    ]);
  });
});
