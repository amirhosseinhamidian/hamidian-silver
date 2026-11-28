import { expect, test } from '@playwright/test';
import { waitForClientHydration } from './support/accessibility';

const mockApi = 'http://127.0.0.1:4311';

test('shows the festival menu and optional deadline and hides the placements when paused', async ({
  page,
  request,
}) => {
  const fixture = `${mockApi}/__e2e/festival-header`;
  expect((await request.post(fixture, { data: { state: 'active' } })).ok()).toBe(true);
  try {
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/campaigns/festival-nowruz');
    const notice = page.getByRole('complementary', { name: 'جشنوارهٔ آزمایشی' });
    await expect(notice.getByText('پیشنهاد ویژهٔ جشنواره')).toBeVisible();
    const timer = notice.locator('[aria-label="شمارش معکوس"]');
    await expect(timer.getByText('۰۲ ساعت')).toBeVisible();
    await expect(notice.getByRole('link', { name: 'دیدن پیشنهادها' })).toHaveAttribute(
      'href',
      '/products',
    );
    await expect(notice).toHaveCSS('background-color', 'rgb(32, 22, 46)');

    await waitForClientHydration(page);
    const mobileMenu = page.getByRole('button', { name: 'باز کردن منوی موبایل' });
    const mobile = await mobileMenu.isVisible();
    if (mobile) await mobileMenu.click();
    const navigation = page.getByRole('navigation', {
      name: mobile ? 'منوی موبایل' : 'پیمایش اصلی',
    });
    await expect(navigation).toHaveCSS('direction', 'rtl');
    const link = navigation.getByRole('link', { name: 'پیشنهاد نوروز', exact: true });
    await expect(link).toHaveAttribute('href', '/campaigns/festival-nowruz');
    await expect(link).toHaveCSS('animation-name', 'none');
    if (mobile) await page.getByRole('button', { name: 'بستن منوی موبایل' }).click();

    expect(
      (await request.post(fixture, { data: { state: 'active', showCountdown: false } })).ok(),
    ).toBe(true);
    await page.reload();
    await expect(notice).toBeVisible();
    await expect(timer).toHaveCount(0);
    await waitForClientHydration(page);

    expect((await request.post(fixture, { data: { state: 'paused' } })).ok()).toBe(true);
    await page.clock.fastForward(31_000);
    await expect(notice).toHaveCount(0);
    if (mobile) await mobileMenu.click();
    await expect(link).toHaveCount(0);
  } finally {
    await request.post(fixture, { data: {} });
  }
});

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

test('keeps public festival URLs crawlable without indexing and serves the ended edition without offers', async ({
  page,
  request,
  baseURL,
}) => {
  for (const [suffix, canonical] of [
    ['?page=2', '?page=2'],
    ['?category=rings&sort=price-asc', ''],
  ]) {
    const response = await page.goto(`/campaigns/festival-nowruz${suffix}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      'content',
      'noindex, follow',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${baseURL}/campaigns/festival-nowruz${canonical}`,
    );
  }
  const ended = await page.goto('/campaigns/festival-ended');
  expect(ended?.status()).toBe(200);
  await expect(page.getByText('این نوبت جشنواره به پایان رسیده است.')).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    'noindex, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${baseURL}/campaigns/festival-ended`,
  );
  await expect(page.getByRole('link', { name: 'مشاهده و خرید' })).toHaveCount(0);
  for (const suffix of [
    'festival-draft',
    'festival-scheduled',
    'festival-paused',
    'festival-archived',
    'festival-ended?page=2',
  ]) {
    expect((await request.get(`/campaigns/${suffix}`)).status()).toBe(404);
  }
  expect((await request.get('/api/campaigns/festival-ended/products?page=1')).status()).toBe(404);

  const rsc = await request.get('/campaigns/festival-nowruz', { headers: { RSC: '1' } });
  expect(rsc.status()).toBe(200);
  expect(rsc.headers()['cache-control']).toMatch(/\bno-store\b|^no-cache, must-revalidate$/);
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/^Allow: \/$/m);
  expect(robots).not.toMatch(/^Disallow: \/campaigns/m);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).not.toContain('/campaigns/festival-');
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
  await waitForClientHydration(page);
  await category.click();
  await page.getByRole('option', { name: 'انگشتر', exact: true }).click();
  await sort.click();
  await page.getByRole('option', { name: 'کمترین قیمت', exact: true }).click();
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
  const appended = products
    .locator('li[data-festival-card]')
    .getByRole('link', { name: 'زنجیر نقره آتنا', exact: true })
    .last();
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
  await expect(category).toHaveText('انگشتر');
  await expect(sort).toHaveText('کمترین قیمت');
  await page.getByRole('link', { name: 'رفتن به پاورقی فروشگاه' }).click();
  await expect(page).toHaveURL(/#storefront-footer$/);
  await expect(page.locator('#storefront-footer')).toBeInViewport();
});

test('applies festival card colors to real prices and quotas only inside the designed landing', async ({
  page,
}) => {
  await page.goto('/campaigns/festival-nowruz');
  await expect(page.getByRole('heading', { name: 'منتخب جشنواره' })).toBeVisible();
  const rings = page.locator('li[data-festival-card]').filter({
    has: page.getByRole('heading', { name: 'انگشتر نقره حمیدیان', exact: true }),
  });
  await expect(rings).toHaveCount(2);
  const card = page
    .locator('#campaign-products')
    .locator('li[data-festival-card]')
    .filter({
      has: page.getByRole('heading', { name: 'انگشتر نقره حمیدیان', exact: true }),
    });
  await expect(card).toHaveCSS('background-color', 'rgb(33, 22, 45)');
  await expect(card.getByText('جشنوارهٔ نوروز', { exact: true })).toHaveCSS(
    'background-color',
    'rgb(255, 212, 154)',
  );
  await expect(card.getByText('۱۰٪', { exact: true })).toHaveCSS(
    'background-color',
    'rgb(255, 200, 234)',
  );
  await expect(card.getByText('۷۲۰,۰۰۰ تومان', { exact: true })).toHaveCSS(
    'color',
    'rgb(255, 221, 168)',
  );
  await expect(
    card.getByRole('progressbar', { name: 'فروش سهمیهٔ جشنوارهٔ نوروز' }),
  ).toHaveAttribute('value', '2');
  await expect(card.getByRole('progressbar')).toHaveCSS('border-top-color', 'rgb(158, 208, 192)');
  await expect(card.getByRole('link', { name: 'مشاهده و خرید' })).toHaveAttribute(
    'href',
    '/products/silver-ring',
  );
  await expect(card.getByRole('link', { name: 'مشاهده و خرید' })).toHaveCSS(
    'background-color',
    'rgb(208, 185, 255)',
  );
  await expect(card.getByRole('button', { name: 'افزودن به علاقه‌مندی‌ها' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(card.getByText('انگشتر نقره برای آزمون کامل فرایند خرید.')).toBeHidden();

  await page.goto('/campaigns/nowruz');
  await expect(
    page.getByRole('heading', { name: 'انگشتر نقره حمیدیان', exact: true }),
  ).toBeVisible();
  await expect(page.locator('li[data-festival-card]')).toHaveCount(0);
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
