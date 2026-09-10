const PRIVATE_PATH_PREFIXES = ['/account', '/api', '/cart', '/checkout', '/payment', '/wishlist'];

function requiredOrigin(): URL {
  const value = process.env.SEO_AUDIT_ORIGIN?.trim();
  if (!value) throw new Error('SEO_AUDIT_ORIGIN is required.');
  const origin = new URL(value);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/') {
    throw new Error('SEO_AUDIT_ORIGIN must be an HTTP(S) origin without a path.');
  }
  return new URL(origin.origin);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function fetchText(origin: URL, pathname: string, redirect: RequestRedirect = 'follow') {
  const response = await fetch(new URL(pathname, origin), {
    redirect,
    headers: { 'user-agent': 'HamidianSilverSeoAudit/1.0' },
  });
  const body = await response.text();
  return { response, body };
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function sitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => decodeXml(match[1].trim()));
}

function htmlAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1] ?? null;
}

function canonicalUrl(html: string): string | null {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = htmlAttribute(match[0], 'rel');
    if (rel?.toLowerCase().split(/\s+/).includes('canonical')) {
      return htmlAttribute(match[0], 'href');
    }
  }
  return null;
}

function hasNoIndex(html: string): boolean {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].some((match) => {
    const name = htmlAttribute(match[0], 'name')?.toLowerCase();
    const content = htmlAttribute(match[0], 'content')?.toLowerCase() ?? '';
    return (name === 'robots' || name === 'googlebot') && content.includes('noindex');
  });
}

function jsonLdTypes(html: string): Set<string> {
  const types = new Set<string>();
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const value = JSON.parse(match[1]) as unknown;
      const records =
        typeof value === 'object' &&
        value !== null &&
        '@graph' in value &&
        Array.isArray(value['@graph'])
          ? value['@graph']
          : [value];
      for (const record of records) {
        if (typeof record !== 'object' || record === null || !('@type' in record)) continue;
        const type = record['@type'];
        if (typeof type === 'string') types.add(type);
        if (Array.isArray(type)) {
          type.forEach((entry) => typeof entry === 'string' && types.add(entry));
        }
      }
    } catch {
      throw new Error('A JSON-LD block contains invalid JSON.');
    }
  }
  return types;
}

async function run(): Promise<void> {
  const origin = requiredOrigin();
  const failures: string[] = [];
  let locations: string[] = [];

  const check = async (label: string, task: () => Promise<void>) => {
    try {
      await task();
      console.log(`PASS ${label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown audit failure.';
      failures.push(`${label}: ${message}`);
      console.error(`FAIL ${label}: ${message}`);
    }
  };

  await check('robots.txt', async () => {
    const { response, body } = await fetchText(origin, '/robots.txt');
    assert(response.ok, `robots.txt returned ${response.status}.`);
    assert(
      body.includes(`Sitemap: ${new URL('/sitemap.xml', origin).href}`),
      'Sitemap directive is missing.',
    );
    for (const pathname of ['/api/', '/account/', '/cart', '/checkout', '/payment/', '/wishlist']) {
      assert(body.includes(`Disallow: ${pathname}`), `robots.txt does not disallow ${pathname}.`);
    }
  });

  await check('sitemap.xml', async () => {
    const { response, body } = await fetchText(origin, '/sitemap.xml');
    assert(response.ok, `sitemap.xml returned ${response.status}.`);
    locations = sitemapLocations(body);
    assert(locations.length > 0, 'The sitemap has no URL entries.');
    assert(new Set(locations).size === locations.length, 'The sitemap contains duplicate URLs.');
    for (const location of locations) {
      const url = new URL(location);
      assert(url.origin === origin.origin, `Cross-origin sitemap URL: ${location}`);
      assert(
        !PRIVATE_PATH_PREFIXES.some(
          (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
        ),
        `Private URL exists in sitemap: ${location}`,
      );
    }
    for (const pathname of ['/', '/products', '/brands']) {
      assert(locations.includes(new URL(pathname, origin).href), `Sitemap is missing ${pathname}.`);
    }
  });

  await check('public canonicals', async () => {
    for (const pathname of ['/', '/products', '/brands']) {
      const { response, body } = await fetchText(origin, pathname);
      assert(response.ok, `${pathname} returned ${response.status}.`);
      assert(!hasNoIndex(body), `${pathname} unexpectedly contains noindex.`);
      assert(
        canonicalUrl(body) === new URL(pathname, origin).href,
        `${pathname} canonical is invalid.`,
      );
    }
  });

  await check('product structured data', async () => {
    const configuredProductPath = process.env.SEO_AUDIT_PRODUCT_PATH?.trim();
    const productUrl = configuredProductPath
      ? new URL(configuredProductPath, origin).href
      : locations.find((location) => {
          const pathname = new URL(location).pathname;
          return pathname.startsWith('/products/') && pathname !== '/products/';
        });
    assert(
      productUrl,
      'No product URL was found in sitemap.xml. Set SEO_AUDIT_PRODUCT_PATH for a custom canonical path.',
    );
    assert(
      new URL(productUrl).origin === origin.origin,
      'The sample product must use the audited origin.',
    );
    const response = await fetch(productUrl, {
      headers: { 'user-agent': 'HamidianSilverSeoAudit/1.0' },
    });
    const body = await response.text();
    assert(response.ok, `Sample product returned ${response.status}.`);
    assert(canonicalUrl(body) === productUrl, 'Sample product canonical does not match sitemap.');
    const types = jsonLdTypes(body);
    assert(types.has('Product'), 'Sample product has no Product JSON-LD.');
    assert(types.has('BreadcrumbList'), 'Sample product has no BreadcrumbList JSON-LD.');
  });

  const redirectPath = process.env.SEO_AUDIT_REDIRECT_PATH?.trim();
  const expectedDestination = process.env.SEO_AUDIT_REDIRECT_DESTINATION?.trim();
  if (redirectPath || expectedDestination) {
    await check('legacy 308 redirect', async () => {
      assert(redirectPath && expectedDestination, 'Both redirect audit variables are required.');
      const { response } = await fetchText(origin, redirectPath, 'manual');
      assert(response.status === 308, `Legacy path returned ${response.status}, expected 308.`);
      const location = response.headers.get('location');
      assert(
        location && new URL(location, origin).href === new URL(expectedDestination, origin).href,
        `Legacy redirect destination is ${location ?? 'missing'}.`,
      );
    });
  }

  if (failures.length > 0) {
    throw new Error(`SEO production audit failed with ${failures.length} check(s).`);
  }
  console.log(`SEO production audit passed for ${origin.origin}.`);
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
