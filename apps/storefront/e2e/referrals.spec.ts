import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForClientHydration } from './support/accessibility';

test('prefills an invite link and registers it only after the customer confirms', async ({
  page,
}) => {
  const code = 'ABCDEFGHIJKLMNOPQRSTUVWX';
  let writes = 0;
  await page.route('**/api/referrals?page=*', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        code: null,
        attributionDays: 30,
        incoming: null,
        outgoing: { items: [], page: 1, hasMore: false },
      },
    }),
  );
  await page.route('**/api/referrals/claim', (route) => {
    writes += 1;
    expect(route.request().postDataJSON()).toEqual({ code });
    return route.fulfill({
      json: {
        id: 'sample-claim',
        status: 'PENDING',
        claimedAt: '2026-11-24T11:00:00.000Z',
        expiresAt: '2026-12-24T11:00:00.000Z',
        firstPaidAt: null,
        firstOrderId: null,
      },
    });
  });
  await page.goto(`/account/referrals#code=${code}`);
  await waitForClientHydration(page);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('textbox', { name: 'کد دوست' })).toHaveValue(code);
  expect(writes).toBe(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'ثبت کد معرفی' }).click();
  await expect(page.getByText('کد معرفی ثبت شد.')).toBeVisible();
  await expect(page.getByText('در انتظار اولین پرداخت قطعی')).toBeVisible();
  expect(writes).toBe(1);
  await expect(page).toHaveURL(/\/account\/referrals$/);
});
