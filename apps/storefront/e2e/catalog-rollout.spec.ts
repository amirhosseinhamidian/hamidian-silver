import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForClientHydration } from './support/accessibility';

test('keeps filtered catalog URLs and clearing filters usable when controls are paused', async ({
  page,
}) => {
  test.skip(process.env.CATALOG_FACETS_ENABLED !== 'false', 'Run with catalog controls paused.');
  const response = await page.goto('/categories/rings?availability=out-of-stock');
  expect(response?.status()).toBe(200);
  await waitForClientHydration(page);
  await expect(page.getByTestId('catalog-result-count')).toHaveText('۱ محصول');
  await expect(page.getByRole('heading', { name: 'انگشتر ناموجود نمونه' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'فیلتر محصولات' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^فیلتر(?:\s|$)/ })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/categories\/rings$/,
  );
  await page.getByRole('button', { name: 'پاک کردن همه فیلترها' }).click();
  await expect(page).toHaveURL(/\/categories\/rings$/);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    /(?:^|,\s*)index(?:,|$)/,
  );
  await expectNoHorizontalOverflow(page);
});
