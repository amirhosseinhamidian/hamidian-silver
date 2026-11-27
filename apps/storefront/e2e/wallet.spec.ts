import { expect, test } from '@playwright/test';
import { SESSION_COOKIE_NAME } from '../src/lib/auth/session-cookie';
import { formatTomanPrice } from '../src/lib/catalog/presentation';
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

test('shows released wallet credit and keeps a late confirmation in review', async ({
  page,
  request,
}) => {
  const mockApi = 'http://127.0.0.1:4311';
  const orderId = '30000000-0000-4000-8000-000000000001';
  const setup = await request.post(`${mockApi}/__e2e/reset`);
  expect(setup.ok()).toBeTruthy();
  type WalletPaymentState = 'pending' | 'expired' | 'reconciliation';
  let state: WalletPaymentState = 'pending';
  async function changePayment(newState: WalletPaymentState) {
    const response = await request.post(`${mockApi}/__e2e/wallet-payment`, {
      data: { state: newState },
    });
    expect(response.ok()).toBeTruthy();
    state = newState;
  }

  try {
    await test.step('sign in through the storefront OTP routes', async () => {
      await page.goto('/privacy');
      const status = await page.evaluate(async () => {
        const phone = '09123456789';
        const headers = { 'Content-Type': 'application/json' };
        const challenge = await fetch('/api/auth/otp/request', {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone }),
        });
        if (!challenge.ok) return { challenge: challenge.status };

        const verification = await fetch('/api/auth/otp/verify', {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone, code: '12345' }),
        });
        return { challenge: challenge.status, verification: verification.status };
      });
      expect(status).toEqual({ challenge: 202, verification: 200 });
      expect(await page.context().cookies(page.url())).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: SESSION_COOKIE_NAME, secure: true, httpOnly: true }),
        ]),
      );
    });
    await page.route('**/api/profile', (route) =>
      route.fulfill({ json: { phone: '09123456789' } }),
    );
    await page.route('**/api/profile/addresses', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/orders', (route) => route.fulfill({ json: { items: [], total: 0 } }));
    await page.route('**/api/wallet', (route) =>
      route.fulfill({
        json: {
          availableToman: state === 'pending' ? 40_000 : 60_000,
          pendingToman: 0,
          reservedToman: state === 'pending' ? 20_000 : 0,
          nextExpiryAt: null,
          nextExpiryToman: 0,
        },
      }),
    );
    await page.route('**/api/wallet/ledger?*', (route) =>
      route.fulfill({ json: { page: 1, hasMore: false, items: [] } }),
    );

    await changePayment('pending');
    const paymentPage = `/payment/result?orderId=${orderId}&receipt=1`;
    await page.goto(paymentPage);
    await expect(
      page.getByRole('heading', { name: 'نتیجه پرداخت در حال بررسی است' }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);

    async function walletAvailable(amount: number) {
      await page.goto('/account');
      await waitForClientHydration(page);
      await page.getByRole('tab', { name: 'کیف پول' }).click();
      const wallet = page.getByRole('tabpanel', { name: 'کیف پول' });
      await expect(wallet.getByText(formatTomanPrice(amount), { exact: true })).toBeVisible();
    }
    await walletAvailable(40_000);
    await changePayment('expired');
    await page.goto(paymentPage);
    await expect(page.getByRole('heading', { name: 'پرداخت تکمیل نشد' })).toBeVisible();
    await walletAvailable(60_000);

    await changePayment('reconciliation');
    await page.goto(paymentPage);
    await expect(
      page.getByRole('heading', { name: 'نتیجه پرداخت در حال بررسی است' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'بررسی وضعیت سفارش' }).click();
    await expect(page.getByRole('heading', { name: 'پرداخت در حال بررسی' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'پرداخت سفارش', exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await walletAvailable(60_000);
  } finally {
    await request.post(`${mockApi}/__e2e/reset`);
  }
});
