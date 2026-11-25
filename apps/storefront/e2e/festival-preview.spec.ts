import { expect, test } from '@playwright/test';

const adminOrigin = 'http://127.0.0.1:4311';
const storeOrigin = 'http://localhost:4310';
const nonce = '11111111-2222-4333-8444-555555555555';
const hostPath = `${adminOrigin}/__e2e/festival-preview-host`;

const snapshot = {
  title: 'طرح خصوصی جشنواره',
  story: 'توضیح ذخیره‌نشده',
  slug: 'festival-nowruz',
  campaignId: nonce,
  endsAt: '2099-03-22T00:00:00Z',
  design: {
    theme: {
      background: '#21162d',
      surface: '#282237',
      foreground: '#ffffff',
      accent: '#ffd0ef',
      decoration: 'NONE',
      motion: 'STILL',
    },
    filterCategories: [],
    filterBrands: [],
    sections: [{ kind: 'PRODUCTS', title: 'محصولات خصوصی', layout: 'GRID' }],
  },
  products: {
    page: 1,
    total: 1,
    pageSize: 8,
    totalPages: 1,
    items: [
      {
        id: nonce,
        slug: 'silver-ring',
        name: 'انگشتر پیش‌نمایش',
        availableQuantity: 1,
        isAvailable: true,
        salePriceToman: 800_000,
        compareAtPriceToman: null,
        primaryMedia: null,
        brand: null,
        categories: [],
      },
    ],
  },
  announcement: {
    name: 'جشنوارهٔ خصوصی',
    message: 'متن اعلان ذخیره‌نشده',
    endsAt: '2099-03-22T00:00:00Z',
    ctaPath: '/products',
    ctaLabel: 'دیدن پیشنهاد',
    media: null,
    display: { showCountdown: false },
  },
};

test('keeps the preview private and accepts successive snapshots only for the paired window', async ({
  page,
  request,
}) => {
  const shell = await request.get(`${storeOrigin}/campaign-preview`);
  expect(shell.ok()).toBe(true);
  // next dev overrides the HTML cache header for the shell. Draft data is delivered separately.
  expect(shell.headers()['cache-control']).toMatch(/\bno-store\b|^no-cache, must-revalidate$/);
  expect(shell.headers()['x-robots-tag']).toContain('noindex');
  expect(await shell.text()).not.toContain(snapshot.title);

  const previewUrl = `${storeOrigin}/campaign-preview#${new URLSearchParams({ nonce, admin: adminOrigin })}`;
  await page.route(hostPath, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<button id="open">Open preview</button><script>
      const openerButton = document.querySelector('#open');
      openerButton.addEventListener('click', () => { window.previewPopup = window.open(${JSON.stringify(previewUrl)}); });
      window.addEventListener('message', (event) => {
        if (event.origin === ${JSON.stringify(storeOrigin)} && event.source === window.previewPopup && event.data?.kind === 'festival-preview-ready') {
          document.body.dataset.ready = 'yes';
        }
      });
    </script>`,
    }),
  );
  await page.goto(hostPath);
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open preview' }).click();
  const popup = await popupPromise;
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'yes');

  async function send(value: typeof snapshot, token: string) {
    await page.evaluate(
      ({ value, token, origin }) => {
        const { previewPopup } = window as typeof window & { previewPopup?: Window | null };
        if (!previewPopup || previewPopup.closed) {
          throw new Error('The festival preview window is unavailable.');
        }
        previewPopup.postMessage(
          { kind: 'festival-preview', nonce: token, payload: value },
          origin,
        );
      },
      { value, token, origin: storeOrigin },
    );
  }

  const frame = popup.frameLocator('iframe');
  await send(snapshot, 'incorrect');
  await expect(frame.getByText('پیش‌نمایش را از پنل کمپین باز کنید.')).toBeVisible();
  await send(snapshot, nonce);
  await expect(frame.getByRole('heading', { name: snapshot.title })).toBeVisible();
  await expect(frame.getByText(snapshot.announcement.message)).toBeVisible();
  await expect(frame.getByRole('button', { name: 'افزودن به علاقه‌مندی‌ها' })).toBeDisabled();
  await frame.getByRole('link', { name: 'دیدن پیشنهاد', exact: true }).click();
  await expect(frame.getByRole('heading', { name: snapshot.title })).toBeVisible();

  await popup.getByRole('button', { name: 'موبایل', exact: true }).click();
  await expect(popup.locator('iframe')).toHaveCSS('width', '390px');
  await popup.getByRole('button', { name: 'تبلت', exact: true }).click();
  await expect(popup.locator('iframe')).toHaveCSS('width', '820px');
  await popup.getByRole('button', { name: 'تمام‌صفحه', exact: true }).click();
  await expect(popup.getByRole('button', { name: 'تمام‌صفحه', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await send({ ...snapshot, title: 'طرح خصوصی ویرایش‌شده' }, nonce);
  await expect(frame.getByRole('heading', { name: 'طرح خصوصی ویرایش‌شده' })).toBeVisible();
  await popup.close();
});
