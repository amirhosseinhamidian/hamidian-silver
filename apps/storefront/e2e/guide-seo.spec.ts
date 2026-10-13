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
