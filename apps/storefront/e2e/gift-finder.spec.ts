import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForClientHydration } from './support/accessibility';

test('finds available gifts within budget and preserves preferences when editing', async ({
  page,
}) => {
  await page.goto('/gift-finder?collection=nowruz');
  await waitForClientHydration(page);
  await expect(page.getByRole('heading', { name: 'راهنمای انتخاب هدیه' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/gift-finder$/);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    /noindex.*follow/,
  );
  await expect(page.getByRole('link', { name: 'دیدن مجموعهٔ نوروز' })).toHaveAttribute(
    'href',
    '/campaigns/nowruz',
  );
  await page.getByLabel('مناسبت', { exact: true }).selectOption('birthday');
  await page.getByLabel('هدیه برای چه کسی است؟').selectOption('women');
  await page.getByRole('button', { name: 'ادامه' }).click();
  await expect(page.getByRole('heading', { name: 'بودجه', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'ادامه' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'بودجه را به تومان' })).toBeVisible();
  await page.getByLabel(/حداکثر بودجه/).fill('۶۰۰٬۰۰۰');
  await page.getByRole('button', { name: 'ادامه' }).click();
  await page.getByLabel('سبک', { exact: true }).selectOption('minimal');
  await page.getByLabel('نوع محصول', { exact: true }).selectOption('rings');
  await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'کمترین قیمتِ موجود' })).toContainText(
    /۸۰۰.۰۰۰ تومان/,
  );
  await page.getByRole('button', { name: 'افزایش بودجه' }).click();
  await expect(page.getByLabel(/حداکثر بودجه/)).toHaveValue('800000');
  await page.getByRole('button', { name: 'ادامه' }).click();
  await expect(page.getByLabel('سبک', { exact: true })).toHaveValue('minimal');
  await expect(page.getByLabel('نوع محصول', { exact: true })).toHaveValue('rings');
  await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click();
  const products = page.getByRole('list', { name: 'محصولات پیشنهادی' });
  await expect(products.getByRole('listitem')).toHaveCount(1);
  await expect(products.getByText(/واریانت موجود در بودجه از ۸۰۰.۰۰۰ تومان/)).toBeVisible();
  await expect(products.getByRole('link', { name: 'مشاهده و خرید' })).toHaveAttribute(
    'href',
    '/products/silver-ring',
  );
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'تغییر ترجیحات' }).click();
  await expect(page.getByLabel('مناسبت', { exact: true })).toHaveValue('birthday');
  await expect(page.getByLabel('هدیه برای چه کسی است؟')).toHaveValue('women');
  await expect(products).toHaveCount(0);
});

test('keeps the gift finder available for an archived collection', async ({ page }) => {
  await page.goto('/gift-finder?collection=archived-nowruz');
  await expect(page.getByRole('heading', { name: 'راهنمای انتخاب هدیه' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'دیدن مجموعهٔ آزمایشی' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ادامه' })).toBeEnabled();
});
