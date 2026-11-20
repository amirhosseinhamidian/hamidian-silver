import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow, waitForClientHydration } from './support/accessibility';

test('applies multiple facets, preserves sort and restores results with browser history', async ({
  page,
}) => {
  await page.goto('/products');
  await waitForClientHydration(page);
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
  const filterButton = page.getByRole('button', { name: /^فیلتر(?:\s|$)/ });
  const sheet = page.getByRole('dialog', { name: 'فیلتر محصولات' });
  const controls = desktop ? page.getByRole('complementary', { name: 'فیلتر محصولات' }) : sheet;

  if (!desktop) {
    await filterButton.click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(filterButton).toBeFocused();
    await filterButton.click();
  }
  await controls.getByRole('checkbox', { name: /برند نمونه/ }).check();
  await controls.getByRole('checkbox', { name: /آتلیه/ }).check();
  await controls.getByRole('textbox', { name: /حداکثر قیمت/ }).fill('۹۰۰٬۰۰۰');
  await controls.getByRole('button', { name: 'اعمال فیلترها' }).click();
  await expect(page.getByTestId('catalog-result-count')).toHaveText('۱ محصول');
  expect(new URL(page.url()).searchParams.getAll('brand').sort()).toEqual(['atelier', 'sample']);
  expect(new URL(page.url()).searchParams.get('maxPriceToman')).toBe('900000');
  await expect(page.getByRole('heading', { name: 'انگشتر نقره حمیدیان', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'حذف فیلتر آتلیه' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/products$/);

  await page.getByRole('combobox', { name: 'مرتب‌سازی محصولات' }).click();
  await page.getByRole('option', { name: 'کمترین قیمت' }).click();
  await expect(page).toHaveURL(/sort=price-asc/);
  await page.goBack();
  await expect(page).not.toHaveURL(/sort=/);
  await expect(page.getByRole('button', { name: 'حذف فیلتر آتلیه' })).toBeVisible();
  await page.getByRole('button', { name: 'پاک کردن همه فیلترها' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole('region', { name: 'فیلترهای فعال' })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId('catalog-result-count')).toHaveText('۱ محصول');
  await page.goForward();
  await expect(page).toHaveURL(/\/products$/);
  await expectNoHorizontalOverflow(page);
});

test('retains the collection path and explains empty or unavailable results', async ({ page }) => {
  await page.goto('/categories/rings?availability=out-of-stock');
  await waitForClientHydration(page);
  await expect(page.getByTestId('catalog-result-count')).toHaveText('۱ محصول');
  await expect(page.getByRole('heading', { name: 'انگشتر ناموجود نمونه' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'مشاهده محصول', exact: true })).toBeVisible();
  await page.goto('/categories/rings?q=unknown-fixture');
  await waitForClientHydration(page);
  await expect(page.getByRole('heading', { name: 'محصولی پیدا نشد' })).toBeVisible();
  await page.getByRole('button', { name: 'بازگشت به فهرست محصولات' }).click();
  await expect(page).toHaveURL(/\/categories\/rings$/);
  await expect(page.getByRole('heading', { name: 'انگشتر نقره حمیدیان', level: 2 })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
