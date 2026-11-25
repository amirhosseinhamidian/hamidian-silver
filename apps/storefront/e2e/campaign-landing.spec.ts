import { expect, test } from '@playwright/test';
import { waitForClientHydration } from './support/accessibility';

const mockApi = 'http://127.0.0.1:4311';

test('shows the collection without horizontal overflow and normalizes campaign URLs', async ({
  page,
  baseURL,
}) => {
  await page.goto('/campaigns/nowruz?utm_source=newsletter');
  await expect(page.getByRole('heading', { name: 'مجموعهٔ نوروز', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'دیدن محصولات مجموعه' })).toHaveAttribute(
    'href',
    '#campaign-products',
  );
  await expect(page.getByRole('heading', { name: 'انگشتر نقره حمیدیان' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    'index, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${baseURL}/campaigns/nowruz`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);

  await page.getByRole('link', { name: 'صفحهٔ بعد' }).click();
  await expect(page.getByRole('heading', { name: 'زنجیر نقره آتنا' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    'noindex, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${baseURL}/campaigns/nowruz?page=2`,
  );

  await page.goto('/campaigns/nowruz?minPriceToman=10');
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    'noindex, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${baseURL}/campaigns/nowruz`,
  );
});

test('keeps festival, temporary, archived and empty pages out of the index', async ({
  page,
  request,
}) => {
  for (const slug of ['festival-nowruz', 'weekend', 'archived-nowruz', 'empty-collection']) {
    const response = await page.goto(`/campaigns/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      'content',
      'noindex, follow',
    );
  }
  await expect(
    page.getByText('در حال حاضر محصول قابل خریدی در این مجموعه موجود نیست.'),
  ).toBeVisible();
  expect((await request.get('/campaigns/expired-temporary')).status()).toBe(404);
  expect((await request.get('/campaigns/nowruz?page=3')).status()).toBe(404);
});

test('renders a designed festival, pages with filters, restores results and reaches the footer', async ({
  page,
  baseURL,
}) => {
  const pages: URLSearchParams[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/campaigns/festival-nowruz/products') pages.push(url.searchParams);
  });

  await page.goto('/campaigns/festival-nowruz');
  await expect(page.getByRole('heading', { name: 'مزایای جشنواره' })).toBeVisible();
  await expect(page.getByText('راهنمای خرید در جشنواره')).toBeVisible();
  await expect(page.getByRole('img', { name: 'تصویر مزایای جشنواره' })).toBeVisible();
  const products = page.locator('#campaign-products');
  const category = products.getByRole('combobox', { name: 'دسته', exact: true });
  const sort = products.getByRole('combobox', { name: 'ترتیب نمایش', exact: true });
  await category.selectOption('rings');
  await sort.selectOption('price-asc');
  await page.getByRole('button', { name: 'اعمال فیلتر' }).click();
  await expect(page).toHaveURL(/category=rings.*sort=price-asc.*#campaign-products$/);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    'noindex, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${baseURL}/campaigns/festival-nowruz`,
  );
  const next = page.getByRole('link', { name: 'صفحهٔ بعد', exact: true });
  await expect(next).toHaveAttribute(
    'href',
    '/campaigns/festival-nowruz?category=rings&sort=price-asc&page=2',
  );

  await waitForClientHydration(page);
  await page.locator('#campaign-list-end').scrollIntoViewIfNeeded();
  const appended = products.getByRole('link', { name: 'زنجیر نقره آتنا', exact: true }).last();
  await expect(appended).toBeVisible();
  expect(
    pages.some(
      (query) =>
        query.get('page') === '2' &&
        query.get('category') === 'rings' &&
        query.get('sort') === 'price-asc',
    ),
  ).toBe(true);
  expect(new URL(page.url()).searchParams.get('page')).toBeNull();

  await appended.click();
  await expect(page).toHaveURL(/\/products\/athena-gold-silver-chain-45cm-model-2$/);
  await page.goBack();
  await expect(appended).toBeInViewport();
  await expect(category).toHaveValue('rings');
  await expect(sort).toHaveValue('price-asc');
  await page.getByRole('link', { name: 'رفتن به پاورقی فروشگاه' }).click();
  await expect(page).toHaveURL(/#storefront-footer$/);
  await expect(page.locator('#storefront-footer')).toBeInViewport();
});

test('uses the standard home slideshow, links catalog banners and lists the eligible landing', async ({
  page,
  request,
  baseURL,
}) => {
  const enabled = await request.post(`${mockApi}/__e2e/campaign-placements`, {
    data: { enabled: true },
  });
  expect(enabled.ok()).toBe(true);
  try {
    await page.goto('/');
    const slideshow = page.getByRole('region', { name: 'اسلایدهای اصلی فروشگاه' });
    await expect(slideshow.getByRole('link', { name: 'مشاهدهٔ جشنواره' })).toHaveAttribute(
      'href',
      '/campaigns/nowruz',
    );
    await expect(page.getByRole('complementary', { name: 'کمپین نوروز' })).toHaveCount(0);

    for (const path of ['/categories/rings', '/products/silver-ring']) {
      await page.goto(path);
      await expect(
        page
          .getByRole('complementary', { name: 'کمپین نوروز' })
          .getByRole('link', { name: 'دیدن مجموعه' }),
      ).toHaveAttribute('href', '/campaigns/nowruz');
    }
    await page.goto('/categories/women-rings');
    await expect(page.getByRole('complementary', { name: 'کمپین نوروز' })).toHaveCount(0);
    const response = await request.get('/sitemap.xml');
    expect(response.ok()).toBe(true);
    const sitemap = await response.text();
    expect(sitemap).toContain(`<loc>${baseURL}/campaigns/nowruz</loc>`);
    expect(sitemap).not.toContain('/campaigns/weekend');
    expect(sitemap).not.toContain('/campaigns/empty-collection');
  } finally {
    await request.post(`${mockApi}/__e2e/campaign-placements`, { data: { enabled: false } });
  }
});
