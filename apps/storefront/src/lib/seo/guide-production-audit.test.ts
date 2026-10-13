import { describe, expect, it, vi } from 'vitest';

import {
  auditPublicGuide,
  guideCanonicalUrl,
  guideJsonLdRecords,
  guidePageHasNoIndex,
  parseGuideSitemapEntries,
} from '@/lib/seo/guide-production-audit';

const origin = new URL('https://silver.example');
const articlePath = '/guide/silver-care';
const hubHtml = `<!doctype html><html><head>
  <link rel="canonical" href="https://silver.example/guide">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"CollectionPage"}</script>
</head><body></body></html>`;
const filteredHtml = `<!doctype html><html><head>
  <meta name="robots" content="noindex,follow">
  <link href="https://silver.example/guide" rel="canonical">
  <script type="application/ld+json">{"@type":"CollectionPage"}</script>
</head><body></body></html>`;
const articleHtml = `<!doctype html><html><head>
  <link rel="canonical" href="https://silver.example${articlePath}">
  <script type="application/ld+json">{"@type":"Article","headline":"نگهداری نقره","inLanguage":"fa-IR","dateModified":"2026-10-12T10:00:00.000Z","isPartOf":{"@id":"https://silver.example/guide#collection"}}</script>
  <script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
</head><body><a href="/guide">دانستنی‌ها</a></body></html>`;

function sitemap(includeArticle = true): string {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset>
    <url><loc>https://silver.example/guide</loc><lastmod>2026-10-12T10:00:00.000Z</lastmod></url>
    ${
      includeArticle
        ? `<url><loc>https://silver.example${articlePath}</loc><lastmod>2026-10-12T11:00:00.000Z</lastmod></url>`
        : ''
    }
  </urlset>`;
}

function fetchFixture(includeArticle = true): typeof fetch {
  return vi.fn(async (input: URL | RequestInfo) => {
    const url = new URL(input instanceof URL ? input.href : String(input));
    if (url.pathname === '/sitemap.xml') {
      return new Response(sitemap(includeArticle), { status: 200 });
    }
    if (url.pathname === '/guide' && url.search) {
      return new Response(filteredHtml, { status: 200 });
    }
    if (url.pathname === '/guide') return new Response(hubHtml, { status: 200 });
    if (url.pathname === articlePath) return new Response(articleHtml, { status: 200 });
    return new Response('missing', { status: 404 });
  }) as typeof fetch;
}

describe('guide production SEO audit', () => {
  it('verifies hub, filtered variant, sitemap and article schema as one release gate', async () => {
    await expect(
      auditPublicGuide({ origin, requireGuide: true, fetchImpl: fetchFixture() }),
    ).resolves.toMatchObject({
      guideArticlePath: articlePath,
      sitemapGuideArticleCount: 1,
      checks: [
        'guide sitemap discovery',
        'guide hub canonical and CollectionPage schema',
        'filtered guide noindex and clean canonical',
        'guide article canonical, sitemap, Article and Breadcrumb schemas',
      ],
    });
  });

  it('allows an empty content hub before editorial launch unless published content is required', async () => {
    await expect(
      auditPublicGuide({ origin, fetchImpl: fetchFixture(false) }),
    ).resolves.toMatchObject({
      guideArticlePath: null,
      sitemapGuideArticleCount: 0,
      notes: [expect.stringContaining('article-level checks were skipped')],
    });

    await expect(
      auditPublicGuide({ origin, requireGuide: true, fetchImpl: fetchFixture(false) }),
    ).rejects.toThrow('No published guide article was found');
  });

  it('supports an explicit article path and rejects a cross-origin sample', async () => {
    await expect(
      auditPublicGuide({ origin, guidePath: articlePath, fetchImpl: fetchFixture() }),
    ).resolves.toMatchObject({ guideArticlePath: articlePath });
    await expect(
      auditPublicGuide({
        origin,
        guidePath: 'https://attacker.example/guide/silver-care',
        fetchImpl: fetchFixture(),
      }),
    ).rejects.toThrow('must use the audited origin');
  });

  it('parses SEO primitives without accepting invalid JSON-LD', () => {
    expect(parseGuideSitemapEntries(sitemap())).toHaveLength(2);
    expect(guideCanonicalUrl(filteredHtml)).toBe('https://silver.example/guide');
    expect(guidePageHasNoIndex(filteredHtml)).toBe(true);
    expect(guideJsonLdRecords(hubHtml)).toMatchObject([{ '@type': 'CollectionPage' }]);
    expect(() =>
      guideJsonLdRecords('<script type="application/ld+json">{invalid}</script>'),
    ).toThrow('invalid JSON');
  });
});
