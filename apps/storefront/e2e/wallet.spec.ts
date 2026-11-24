import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForClientHydration } from './support/accessibility';

test('shows the amount due to expire and reloads the wallet after a reservation is released', async ({
  page,
}) => {
  const expiresAt = '2027-03-01T10:30:00.000Z';
  const recordedAt = '2026-11-24T10:30:00.000Z';
  let released = false;
  let smsEnabled = false;
  let expiryInAppEnabled = true;
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
  await page.route('**/api/wallet/notifications', (route) => {
    if (route.request().method() === 'PATCH') {
      const preferences = route.request().postDataJSON() as {
        activationSmsEnabled: boolean;
        expiryInAppEnabled: boolean;
      };
      smsEnabled = preferences.activationSmsEnabled;
      expiryInAppEnabled = preferences.expiryInAppEnabled;
    }
    return route.fulfill({
      json: {
        activationSmsEnabled: smsEnabled,
        expiryInAppEnabled,
        smsAvailable: true,
        expiryReminderAvailable: true,
        expiryReminder: expiryInAppEnabled
          ? { urgent: true, amountToman: 10_000, expiresAt }
          : null,
      },
    });
  });
  await page.goto('/account');
  await waitForClientHydration(page);
  await page.getByRole('tab', { name: 'کیف پول' }).click();
  const panel = page.getByRole('tabpanel', { name: 'کیف پول' });
  await expect(panel.getByText('رزرو برای پرداخت')).toBeVisible();
  await expect(panel.getByText(/از اعتبار شما تا/)).toContainText(/۱۰.۰۰۰ تومان/);
  await expect(
    panel.getByText(/از اعتبار شما تا/).locator(`time[datetime="${expiresAt}"]`),
  ).toBeVisible();
  await expect(panel.getByText('انقضای اعتبار نزدیک است')).toBeVisible();
  await panel.getByRole('checkbox', { name: 'پیامک فعال‌شدن اعتبار' }).check();
  await panel.getByRole('checkbox', { name: 'یادآوری انقضا در کیف پول' }).uncheck();
  await panel.getByRole('button', { name: 'ذخیرهٔ تنظیمات اعلان' }).click();
  await expect(panel.getByText('تنظیمات اعلان ذخیره شد.')).toBeVisible();
  await expect(panel.getByText('انقضای اعتبار نزدیک است')).toHaveCount(0);
  expect(smsEnabled).toBe(true);
  await expectNoHorizontalOverflow(page);

  released = true;
  await panel.getByRole('button', { name: 'به‌روزرسانی کیف پول' }).click();
  await expect(panel.getByText('آزادسازی رزرو')).toBeVisible();
  await expect(panel.getByText(/۶۰.۰۰۰ تومان/)).toBeVisible();
});
