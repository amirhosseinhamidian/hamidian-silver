export type GuideProductionAuditOptions = Readonly<{
  origin: URL;
  guidePath?: string;
  requireGuide?: boolean;
  fetchImpl?: typeof fetch;
}>;

export type GuideProductionAuditResult = Readonly<{
  origin: string;
  guideArticlePath: string | null;
  sitemapGuideArticleCount: number;
  checks: readonly string[];
  notes: readonly string[];
}>;

type SitemapEntry = Readonly<{ location: string; lastModified: string | null }>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function decodeHtml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'");
}

export function parseGuideSitemapEntries(xml: string): SitemapEntry[] {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].flatMap((match) => {
    const block = match[1];
    const location = block.match(/<loc>([^<]+)<\/loc>/i)?.[1]?.trim();
    if (!location) return [];
    return [
      {
        location: decodeHtml(location),
        lastModified: block.match(/<lastmod>([^<]+)<\/lastmod>/i)?.[1]?.trim() ?? null,
      },
    ];
  });
}

function htmlAttribute(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] ?? null;
}

export function guideCanonicalUrl(html: string): string | null {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = htmlAttribute(match[0], 'rel');
    if (rel?.toLowerCase().split(/\s+/).includes('canonical')) {
      return htmlAttribute(match[0], 'href');
    }
  }
  return null;
}

export function guidePageHasNoIndex(html: string): boolean {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].some((match) => {
    const name = htmlAttribute(match[0], 'name')?.toLowerCase();
    const content = htmlAttribute(match[0], 'content')?.toLowerCase() ?? '';
    return (name === 'robots' || name === 'googlebot') && content.includes('noindex');
  });
}

export function guideJsonLdRecords(html: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let value: unknown;
    try {
      value = JSON.parse(match[1]);
    } catch {
      throw new Error('A guide JSON-LD block contains invalid JSON.');
    }
    const candidates =
      typeof value === 'object' &&
      value !== null &&
      '@graph' in value &&
      Array.isArray(value['@graph'])
        ? value['@graph']
        : [value];
    for (const candidate of candidates) {
      if (typeof candidate === 'object' && candidate !== null) {
        records.push(candidate as Record<string, unknown>);
      }
    }
  }
  return records;
}

function hasType(record: Record<string, unknown>, expected: string): boolean {
  const type = record['@type'];
  return type === expected || (Array.isArray(type) && type.includes(expected));
}

function sameUrl(actual: string | null, expected: URL): boolean {
  if (!actual) return false;
  try {
    const parsed = new URL(decodeHtml(actual));
    return (
      parsed.origin === expected.origin &&
      parsed.pathname.replace(/\/+$/, '') === expected.pathname.replace(/\/+$/, '') &&
      parsed.search === expected.search &&
      parsed.hash === expected.hash
    );
  } catch {
    return false;
  }
}

function guideArticlePath(value: string, origin: URL): string {
  const url = new URL(value, origin);
  assert(url.origin === origin.origin, 'SEO_AUDIT_GUIDE_PATH must use the audited origin.');
  assert(
    /^\/guide\/[^/?#]+$/.test(url.pathname) && !url.search && !url.hash,
    'SEO_AUDIT_GUIDE_PATH must be a clean /guide/{slug} path.',
  );
  return url.pathname;
}

async function fetchText(fetchImpl: typeof fetch, origin: URL, pathname: string) {
  const response = await fetchImpl(new URL(pathname, origin), {
    headers: { 'user-agent': 'HamidianSilverGuideSeoAudit/1.0' },
  });
  return { response, body: await response.text() };
}

export async function auditPublicGuide(
  options: GuideProductionAuditOptions,
): Promise<GuideProductionAuditResult> {
  const origin = new URL(options.origin.origin);
  const fetchImpl = options.fetchImpl ?? fetch;
  const checks: string[] = [];
  const notes: string[] = [];

  const sitemapResponse = await fetchText(fetchImpl, origin, '/sitemap.xml');
  assert(sitemapResponse.response.ok, `sitemap.xml returned ${sitemapResponse.response.status}.`);
  const sitemap = parseGuideSitemapEntries(sitemapResponse.body);
  const sitemapGuideArticles = sitemap.filter(({ location }) => {
    const url = new URL(location);
    return url.origin === origin.origin && /^\/guide\/[^/]+$/.test(url.pathname);
  });
  checks.push('guide sitemap discovery');

  const hub = await fetchText(fetchImpl, origin, '/guide');
  assert(hub.response.ok, `/guide returned ${hub.response.status}.`);
  assert(!guidePageHasNoIndex(hub.body), '/guide unexpectedly contains noindex.');
  assert(
    sameUrl(guideCanonicalUrl(hub.body), new URL('/guide', origin)),
    '/guide canonical is invalid.',
  );
  const hubRecords = guideJsonLdRecords(hub.body);
  assert(
    hubRecords.some((record) => hasType(record, 'CollectionPage')),
    '/guide has no CollectionPage JSON-LD.',
  );
  checks.push('guide hub canonical and CollectionPage schema');

  const filtered = await fetchText(fetchImpl, origin, '/guide?q=seo-audit-nonexistent');
  assert(filtered.response.ok, `Filtered guide returned ${filtered.response.status}.`);
  assert(guidePageHasNoIndex(filtered.body), 'Filtered guide does not contain noindex.');
  assert(
    sameUrl(guideCanonicalUrl(filtered.body), new URL('/guide', origin)),
    'Filtered guide canonical is not the clean /guide URL.',
  );
  checks.push('filtered guide noindex and clean canonical');

  const configuredPath = options.guidePath?.trim();
  const selectedPath = configuredPath
    ? guideArticlePath(configuredPath, origin)
    : sitemapGuideArticles.length
      ? new URL(sitemapGuideArticles[0].location).pathname
      : null;

  if (!selectedPath) {
    assert(
      !options.requireGuide,
      'No published guide article was found in sitemap.xml. Publish one or set SEO_AUDIT_GUIDE_PATH.',
    );
    notes.push('No published guide article was available; article-level checks were skipped.');
    return {
      origin: origin.origin,
      guideArticlePath: null,
      sitemapGuideArticleCount: 0,
      checks,
      notes,
    };
  }

  const article = await fetchText(fetchImpl, origin, selectedPath);
  assert(article.response.ok, `${selectedPath} returned ${article.response.status}.`);
  assert(!guidePageHasNoIndex(article.body), `${selectedPath} unexpectedly contains noindex.`);
  const canonical = new URL(selectedPath, origin);
  assert(
    sameUrl(guideCanonicalUrl(article.body), canonical),
    `${selectedPath} canonical does not match its public URL.`,
  );

  const sitemapEntry = sitemap.find(({ location }) => sameUrl(location, canonical));
  assert(sitemapEntry, `${selectedPath} is missing from sitemap.xml.`);
  assert(sitemapEntry.lastModified, `${selectedPath} sitemap entry has no lastmod.`);
  assert(
    !Number.isNaN(Date.parse(sitemapEntry.lastModified)),
    `${selectedPath} sitemap lastmod is invalid.`,
  );

  const records = guideJsonLdRecords(article.body);
  const articleRecord = records.find((record) => hasType(record, 'Article'));
  assert(articleRecord, `${selectedPath} has no Article JSON-LD.`);
  assert(
    records.some((record) => hasType(record, 'BreadcrumbList')),
    `${selectedPath} has no BreadcrumbList JSON-LD.`,
  );
  assert(articleRecord.inLanguage === 'fa-IR', 'Article JSON-LD language is not fa-IR.');
  assert(
    typeof articleRecord.headline === 'string' && articleRecord.headline.trim().length > 0,
    'Article JSON-LD headline is missing.',
  );
  assert(
    typeof articleRecord.dateModified === 'string' &&
      !Number.isNaN(Date.parse(articleRecord.dateModified)),
    'Article JSON-LD dateModified is missing or invalid.',
  );
  const isPartOf = articleRecord.isPartOf;
  assert(
    typeof isPartOf === 'object' &&
      isPartOf !== null &&
      '@id' in isPartOf &&
      sameUrl(String(isPartOf['@id']), new URL('/guide#collection', origin)),
    'Article JSON-LD is not connected to the guide CollectionPage.',
  );
  assert(
    [...article.body.matchAll(/<a\b[^>]*>/gi)].some((match) => {
      const href = htmlAttribute(match[0], 'href');
      return href
        ? sameUrl(new URL(decodeHtml(href), origin).href, new URL('/guide', origin))
        : false;
    }),
    `${selectedPath} does not link back to /guide.`,
  );
  checks.push('guide article canonical, sitemap, Article and Breadcrumb schemas');

  return {
    origin: origin.origin,
    guideArticlePath: selectedPath,
    sitemapGuideArticleCount: sitemapGuideArticles.length,
    checks,
    notes,
  };
}
