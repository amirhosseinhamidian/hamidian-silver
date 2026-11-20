import { expect, test } from '@playwright/test';

test('links a published subcategory with its own introduction, canonical and breadcrumb schema', async ({
  page,
}) => {
  await page.goto('/categories/rings');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  const child = page.getByRole('navigation', { name: 'زیرمجموعه‌های انگشتر' }).getByRole('link', {
    name: /انگشتر زنانه/,
  });
  await expect(child).toHaveAttribute('href', '/categories/women-rings');
  await child.click();
  await expect(page).toHaveTitle(/راهنمای انتخاب انگشتر زنانه نقره/);
  await expect(page.getByText(/پهنای حلقه و سایز مدلی/)).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/categories\/women-rings$/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');

  const schema = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts
        .map((script) => JSON.parse(script.textContent ?? '{}'))
        .find((value) => value['@type'] === 'BreadcrumbList'),
    );
  expect(
    schema?.itemListElement?.map(({ item }: { item: string }) => new URL(item).pathname),
  ).toEqual(['/', '/categories', '/categories/rings', '/categories/women-rings']);
});

test('serves clean pagination and keeps parameter variants out of the index', async ({
  request,
}) => {
  const brand = await request.get('/brands/sample?page=2');
  expect(brand.status()).toBe(200);
  expect(await brand.text()).toContain(`<link rel="canonical" href="${brand.url()}"`);
  const cleanContent = await (await request.get('/categories/rings')).text();
  expect(cleanContent).toMatch(/<a\b[^>]*href="\/categories\/rings\?page=2"[^>]*>/);

  for (const query of ['sort=featured&page=2', 'page=2&page=2', 'page=2&availability=']) {
    const response = await request.get(`/categories/rings?${query}`);
    expect(response.status(), query).toBe(200);
    const html = await response.text();
    expect(html).toContain('<meta name="robots" content="noindex, follow"');
    expect(html).toContain(
      `<link rel="canonical" href="${new URL('/categories/rings', response.url()).href}"`,
    );
  }
  const filtered = await (await request.get('/categories/rings?sort=featured')).text();
  const nextLink = filtered.match(
    /<a\b[^>]*href="\/categories\/rings\?sort=featured&amp;page=2"[^>]*>/,
  );
  expect(nextLink?.[0]).toContain('rel="nofollow"');

  const missing = await request.get('/products?sort=featured&page=1001');
  expect([200, 404]).toContain(missing.status());
  const missingHtml = await missing.text();
  if (missing.status() === 200) expect(missingHtml).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
  expect(missingHtml).toMatch(/<meta name="robots" content="noindex\b/);
  expect(missingHtml).not.toContain('<link rel="canonical"');

  const malformedApiPage = await request.get('/api/catalog/facets?page=1&page=2');
  expect(malformedApiPage.status()).toBe(400);
  expect(malformedApiPage.headers()['x-robots-tag']).toBe('noindex, nofollow');
});

test('keeps published out-of-stock products and clean collections discoverable', async ({
  request,
}) => {
  const soldOut = await request.get('/products/sold-out-ring');
  expect(soldOut.status()).toBe(200);
  const html = await soldOut.text();
  expect(html).toContain(`<link rel="canonical" href="${soldOut.url()}"`);
  expect(html).toContain('<meta name="robots" content="index, follow"');
  expect(html).toContain('"availability":"https://schema.org/OutOfStock"');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const locations = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, url]) => new URL(url),
  );
  expect(locations.map(({ pathname }) => pathname)).toEqual(
    expect.arrayContaining([
      '/categories/rings',
      '/categories/women-rings',
      '/brands/sample',
      '/products/sold-out-ring',
    ]),
  );
  expect(locations.every(({ search }) => search === '')).toBe(true);
  expect(locations.some(({ pathname }) => pathname === '/products/silver-ring')).toBe(false);

  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${sitemap.url()}`);
});
