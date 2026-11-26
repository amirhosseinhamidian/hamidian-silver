import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  expectNoWcagViolations,
  waitForClientHydration,
} from './support/accessibility';

test('shows distinct credit sources and referral review to the signed-in customer', async ({
  page,
}, testInfo) => {
  const nextExpiry = '2027-03-01T10:30:00.000Z';
  let availableToman = 800;
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { phone: '09123456789' } }));
  await page.route('**/api/profile', (route) => route.fulfill({ json: { phone: '09123456789' } }));
  await page.route('**/api/profile/addresses', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/orders', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'unpaid-order',
            orderNumber: 'HS-1001',
            status: 'PENDING_PAYMENT',
            createdAt: '2026-11-24T10:30:00.000Z',
            grandTotalToman: 20_000,
            items: [],
            payment: { status: 'PENDING', method: 'PAYMENT_GATEWAY', latestAttemptFailed: true },
          },
        ],
        total: 1,
      },
    }),
  );
  await page.route('**/api/wallet', (route) =>
    route.fulfill({
      json: {
        availableToman,
        pendingToman: 5_000,
        reservedToman: 2_000,
        nextExpiryAt: availableToman ? nextExpiry : null,
        sourceBalances: [
          {
            source: 'PURCHASE',
            availableToman,
            pendingToman: 5_000,
            reservedToman: 0,
            expiredToman: 8_000,
          },
          {
            source: 'REFERRAL',
            availableToman: 0,
            pendingToman: 0,
            reservedToman: 2_000,
            expiredToman: 0,
          },
        ],
      },
    }),
  );
  await page.route('**/api/wallet/notifications', (route) =>
    route.fulfill({
      json: {
        expiryReminder: availableToman
          ? { urgent: true, amountToman: 800, expiresAt: nextExpiry }
          : null,
      },
    }),
  );
  await page.route('**/api/referrals?page=1', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        referrerEligible: true,
        code: 'abcdefghijklmnopqrstuvwx',
        incoming: null,
        outgoing: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'referral-1',
              status: 'FIRST_PURCHASE_CONFIRMED',
              rewardStatus: 'IN_REVIEW',
              claimedAt: '2026-11-23T10:30:00.000Z',
              expiresAt: '2026-12-23T10:30:00.000Z',
              firstPaidAt: '2026-11-24T10:30:00.000Z',
            },
          ],
        },
      },
    }),
  );
  await page.goto('/account');
  await waitForClientHydration(page);
  await page.getByRole('tab', { name: 'باشگاه مشتریان' }).click();
  const club = page.getByRole('tabpanel', { name: 'باشگاه مشتریان' });
  const purchase = club.getByRole('region', { name: 'پاداش خرید' });
  await expect(purchase.getByText(/۵.۰۰۰ تومان/)).toBeVisible();
  await expect(purchase.getByText(/۸.۰۰۰ تومان/)).toBeVisible();
  const referral = club.getByRole('region', { name: 'پاداش معرفی' });
  await expect(referral.getByText(/۲.۰۰۰ تومان/)).toBeVisible();
  await expect(club.getByText('abcdefghijklmnopqrstuvwx')).toBeVisible();
  await expect(club.getByText('پاداش معرفی در حال بررسی است.')).toBeVisible();
  await expect(club.getByText(/تلاش قبلی پرداخت ناموفق بود/)).toBeVisible();
  await expect(club.locator(`time[datetime="${nextExpiry}"]`)).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await expectNoWcagViolations(page, testInfo);

  availableToman = 0;
  await club.getByRole('button', { name: 'به‌روزرسانی باشگاه' }).click();
  await expect(club.getByText('فعلاً اعتبار قابل مصرف ندارید.')).toBeVisible();
  await expect(club.locator(`time[datetime="${nextExpiry}"]`)).toHaveCount(0);
});

test('keeps loyalty balances and referral details out of a signed-out account', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: null }));
  let privateRequests = 0;
  await page.route(/\/api\/(wallet|referrals)(\b|\/)/, (route) => {
    privateRequests++;
    return route.fulfill({ status: 401, json: null });
  });
  const response = await page.goto('/account');
  expect(await response?.text()).toMatch(/content="noindex/);
  await expect(page.getByText('برای مشاهده حساب وارد شوید')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'باشگاه مشتریان' })).toHaveCount(0);
  expect(privateRequests).toBe(0);
});
