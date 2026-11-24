import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForClientHydration } from './support/accessibility';

test('shows the amount due to expire and reloads the wallet after a reservation is released', async ({
  page,
}) => {
  const expiresAt = '2027-03-01T10:30:00.000Z';
  const recordedAt = '2026-11-24T10:30:00.000Z';
  let released = false;
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { phone: '09123456789' } }));
  await page.route('**/api/profile', (route) => route.fulfill({ json: { phone: '09123456789' } }));
  await page.route('**/api/profile/addresses', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/orders', (route) => route.fulfill({ json: { items: [], total: 0 } }));
  await page.route('**/api/wallet', (route) =>
    route.fulfill({
      json: {
        availableToman: released ? 60_000 : 40_000,
        pendingToman: 5_000,
        reservedToman: released ? 0 : 20_000,
        nextExpiryAt: expiresAt,
        nextExpiryToman: 10_000,
      },
    }),
  );
  await page.route('**/api/wallet/ledger?*', (route) =>
    route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        items: [
          {
            id: 'entry',
            kind: released ? 'RELEASE' : 'RESERVE',
            recordedAt,
            movements: [
              {
                lotId: 'lot',
                source: 'PURCHASE',
                originOrderId: 'order',
                reservationOrderId: 'checkout-order',
                amountToman: 20_000,
                expiresAt,
                toBucket: released ? 'AVAILABLE' : 'RESERVED',
              },
            ],
          },
        ],
      },
    }),
  );
  await page.goto('/account');
  await waitForClientHydration(page);
  await page.getByRole('tab', { name: 'کیف پول' }).click();
  const panel = page.getByRole('tabpanel', { name: 'کیف پول' });
  await expect(panel.getByText('رزرو برای پرداخت')).toBeVisible();
  await expect(panel.getByText(/از اعتبار شما تا/)).toContainText(/۱۰.۰۰۰ تومان/);
  await expect(panel.locator(`time[datetime="${expiresAt}"]`)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  released = true;
  await panel.getByRole('button', { name: 'به‌روزرسانی کیف پول' }).click();
  await expect(panel.getByText('آزادسازی رزرو')).toBeVisible();
  await expect(panel.getByText(/۶۰.۰۰۰ تومان/)).toBeVisible();
});
