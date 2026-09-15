import { expect, test } from '@playwright/test';

const mockApiOrigin = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  expect((await request.post(`${mockApiOrigin}/__e2e/reset`)).ok()).toBeTruthy();
});

test.afterEach(async ({ request }) => {
  expect((await request.post(`${mockApiOrigin}/__e2e/reset`)).ok()).toBeTruthy();
});

test('unknown URL and deleted product use storefront 404 instead of the Next.js default', async ({
  page,
}) => {
  const unknown = await page.goto('/a-route-that-does-not-exist');
  expect(unknown?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'صفحه موردنظر پیدا نشد' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'مشاهده محصولات' })).toBeVisible();

  const deleted = await page.goto('/products/deleted-silver-ring');
  // A streamed notFound() response can be HTTP 200 in the App Router.
  expect([200, 404]).toContain(deleted?.status());
  await expect(page.getByRole('heading', { name: 'این محصول پیدا نشد' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
});

test('missing media uses the local placeholder without hiding the product', async ({ page }) => {
  await page.route('**/_next/image?**', async (route) => {
    const source = new URL(route.request().url()).searchParams.get('url');
    if (source === `${mockApiOrigin}/media/silver-ring.png`) {
      await route.fulfill({ status: 404 });
    } else {
      await route.continue();
    }
  });
  await page.goto('/products/silver-ring');

  await expect(page.getByRole('heading', { name: 'انگشتر نقره حمیدیان' })).toBeVisible();
  await expect(
    page.locator(
      'section[aria-label="رسانه محصول"] img[src="/images/image-unavailable.svg"]:visible',
    ),
  ).toBeVisible();
});

test('an unverified gateway callback never claims payment was successful or failed', async ({
  page,
}) => {
  await page.goto('/payment/result?status=success&orderId=unknown-order');
  await expect(page.getByRole('heading', { name: 'نتیجه پرداخت در حال بررسی است' })).toBeVisible();
  await expect(page.getByText(/پرداخت را تکرار نکنید/)).toBeVisible();
});

test('a storefront failure during an API outage shows a recovery page without leaking errors', async ({
  page,
  request,
}) => {
  expect(
    (
      await request.post(`${mockApiOrigin}/__e2e/api-unavailable`, { data: { enabled: true } })
    ).ok(),
  ).toBeTruthy();

  await page.goto('/products/silver-ring');
  await expect(
    page.getByRole('heading', {
      name: /^(این صفحه فعلاً در دسترس نیست|دریافت اطلاعات محصولات ممکن نشد)$/,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'تلاش دوباره' })).toBeVisible();
  await expect(page.getByText('Mock API is unavailable.')).toHaveCount(0);
});
