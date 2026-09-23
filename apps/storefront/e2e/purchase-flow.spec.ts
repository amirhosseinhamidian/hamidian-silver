import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow, waitForClientHydration } from './support/accessibility';

test.beforeEach(async ({ request }) => {
  const response = await request.post('http://127.0.0.1:4311/__e2e/reset');
  expect(response.ok()).toBeTruthy();
});

test('OTP → product → cart → checkout → card-to-card receipt', async ({ page }) => {
  await test.step('sign in with OTP', async () => {
    await page.goto('/products/silver-ring');
    await expect(page.getByRole('heading', { name: 'انگشتر نقره حمیدیان' })).toBeVisible();
    await waitForClientHydration(page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'ورود یا ثبت‌نام' }).first().click();
    const authDialog = page.getByRole('dialog', { name: 'ورود یا ثبت‌نام' });
    await authDialog.getByLabel('شماره تلفن همراه').fill('09123456789');
    await authDialog.getByRole('button', { name: 'ارسال کد تأیید' }).click();

    await expect(page.getByRole('dialog', { name: 'تأیید شماره همراه' })).toBeVisible();
    await page.getByLabel('رقم ۱ از ۵').fill('12345');
    await expect(page.getByText('با موفقیت وارد شدید')).toBeVisible();
    await expect(page.getByRole('link', { name: 'حساب کاربری' }).first()).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'ورود موفق' })).toBeHidden({ timeout: 5_000 });
  });

  await test.step('add the product and review the cart', async () => {
    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click();
    await page.getByRole('link', { name: 'مشاهده سبد خرید' }).click();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole('heading', { name: 'سبد خرید' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText('انگشتر نقره حمیدیان').first()).toBeVisible();
    await page.getByRole('link', { name: 'ثبت سفارش' }).first().click();
  });

  await test.step('create the order and submit a card-to-card receipt', async () => {
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText('آدرس پیش‌فرض')).toBeVisible();
    await expect(page.getByText('پست پیشتاز')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const cardToCardMethod = page.getByRole('radio', { name: /پرداخت کارت‌به‌کارت/ });
    await expect(cardToCardMethod).toBeEnabled();
    await cardToCardMethod.check();
    await page.getByRole('button', { name: 'ثبت سفارش و پرداخت کارت‌به‌کارت' }).click();
    const cardDialog = page.getByRole('dialog', { name: 'اطلاعات کارت مقصد' });
    await expect(cardDialog).toBeVisible();
    await cardDialog.getByRole('button', { name: 'پرداخت انجام شد؛ ثبت رسید' }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.getByRole('button', { name: 'ثبت نهایی رسید' }).click();

    await expect(page).toHaveURL(/\/payment\/result\?orderId=.*&receipt=1/);
    await expect(page.getByText('رسید با موفقیت ثبت شد')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'رسید پرداخت شما دریافت شد' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText('HS-E۲E-۱۰۰۱', { exact: true }).first()).toBeVisible();

    await page.getByRole('link', { name: 'پیگیری وضعیت رسید' }).click();
    await expect(page).toHaveURL(/\/account\/orders\/30000000-0000-4000-8000-000000000001$/);
    await expect(page.getByRole('heading', { name: 'جزئیات سفارش' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page.getByText('در انتظار بررسی رسید').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'روند سفارش' })).toBeVisible();
  });
});
