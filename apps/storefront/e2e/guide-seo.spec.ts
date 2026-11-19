import { expect, test, type Page } from '@playwright/test';

async function jsonLdTypes(page: Page): Promise<string[]> {
  return page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
    scripts.flatMap((script) => {
      const value = JSON.parse(script.textContent ?? '{}') as Record<string, unknown>;
      const records = Array.isArray(value['@graph']) ? value['@graph'] : [value];
      return records.flatMap((record) => {
        if (typeof record !== 'object' || record === null || !('@type' in record)) return [];
        const type = record['@type'];
        return Array.isArray(type) ? type.map(String) : typeof type === 'string' ? [type] : [];
      });
    }),
  );
}

test.describe('knowledge hub SEO and internal links', () => {
  test('publishes an indexable hub while keeping search variants out of the index', async ({
    page,
  }) => {
    const response = await page.goto('/guide');
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: 'دانستنی‌ها', level: 1 })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://localhost:4310/guide',
    );
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/);
    expect(await jsonLdTypes(page)).toContain('CollectionPage');
    await expect(page.locator('a[href="/guide/silver-care"]').first()).toBeVisible();

    await page.goto('/guide?q=عبارت-آزمایشی');
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://localhost:4310/guide',
    );
  });

  test('connects an article to schema, commerce pages and related knowledge', async ({ page }) => {
    const response = await page.goto('/guide/silver-care');
    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole('heading', { name: 'راهنمای نگهداری نقره', level: 1 }),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://localhost:4310/guide/silver-care',
    );
    await expect(page.getByText('نقره را کجا نگهداری کنیم؟')).toBeVisible();
    await expect(page.getByRole('link', { name: 'محصولات انگشتر' })).toHaveAttribute(
      'href',
      '/categories/rings',
    );
    await expect(page.getByRole('link', { name: 'آشنایی با برند نمونه' })).toHaveAttribute(
      'href',
      '/brands/sample',
    );
    await expect(page.locator('a[href="/guide/recognize-real-silver"]').first()).toBeVisible();
    expect(await jsonLdTypes(page)).toEqual(
      expect.arrayContaining(['Article', 'FAQPage', 'BreadcrumbList']),
    );

    await page.goto('/products/silver-ring');
    await expect(page.locator('a[href="/guide/silver-care"]').first()).toBeVisible();
  });
});

test.describe('catalog and article URL policies', () => {
  const productPath = '/products/athena-gold-silver-chain-45cm-model-2';

  test('redirects only the observed malformed URLs to their public destinations', async ({
    request,
  }, testInfo) => {
    const redirects = [
      [productPath.replace('/products/', '/products/products/'), productPath],
      [`/guide:${encodeURIComponent('دانستنی‌ها')}`, '/guide'],
    ];

    for (const [source, destination] of redirects) {
      const response = await request.get(source, { maxRedirects: 0 });
      expect(response.status(), source).toBe(308);
      expect(new URL(response.headers().location, testInfo.project.use.baseURL).pathname).toBe(
        destination,
      );
      expect((await request.get(destination, { maxRedirects: 0 })).status()).toBe(200);
    }

    expect(
      (await request.get('/products/products/unrelated-slug', { maxRedirects: 0 })).status(),
    ).toBe(404);
  });

  test('renders a clean canonical and noindex for page parameters on details', async ({ page }) => {
    for (const path of [productPath, '/guide/silver-care']) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');

      await page.goto(`${path}?page=2`);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new URL(path, page.url()).href,
      );
    }
  });

  test('keeps valid pagination indexable and removes SEO metadata for missing pages', async ({
    request,
  }) => {
    for (const path of ['/products', '/categories/rings', '/brands/sample']) {
      const valid = await request.get(`${path}?page=2`);
      expect(valid.status(), path).toBe(200);
      const validHtml = await valid.text();
      expect(validHtml).toContain(`<link rel="canonical" href="${valid.url()}"`);
      expect(validHtml).toContain('<meta name="robots" content="index, follow"');

      const missing = await request.get(`${path}?page=3`);
      expect([200, 404], path).toContain(missing.status());
      const missingHtml = await missing.text();
      if (missing.status() === 200) {
        expect(missingHtml).toContain('NEXT_HTTP_ERROR_FALLBACK;404');
      }
      expect(missingHtml).toMatch(/<meta name="robots" content="noindex\b/);
      expect(missingHtml).not.toContain('<meta name="robots" content="index, follow"');
      expect(missingHtml).not.toContain('<link rel="canonical"');
    }
  });
});
