import { expect, test } from '@playwright/test';

const mockApiOrigin = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${mockApiOrigin}/__e2e/reset`);
  expect(response.ok()).toBeTruthy();
});

test('OTP → product → cart → checkout → gateway → paid order', async ({ page }) => {
  await test.step('sign in with OTP', async () => {
    await page.goto('/products/silver-ring');
    await expect(page.getByRole('heading', { name: 'انگشتر نقره حمیدیان' })).toBeVisible();

    await page.getByRole('button', { name: 'ورود یا ثبت‌نام' }).first().click();
    const authDialog = page.getByRole('dialog', { name: 'ورود یا ثبت‌نام' });
    await authDialog.getByLabel('شماره تلفن همراه').fill('09123456789');
    await authDialog.getByRole('button', { name: 'ارسال کد تأیید' }).click();

    await expect(page.getByRole('dialog', { name: 'تأیید شماره همراه' })).toBeVisible();
    await page.getByLabel('رقم ۱ از ۵').fill('12345');
    await expect(page.getByText('با موفقیت وارد شدید')).toBeVisible();
    await expect(page.getByRole('link', { name: 'حساب کاربری' }).first()).toBeVisible();
  });

  await test.step('add the product and review the cart', async () => {
    await page.getByRole('button', { name: 'افزودن به سبد خرید' }).click();
    await page.getByRole('link', { name: 'مشاهده سبد خرید' }).click();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole('heading', { name: 'سبد خرید' })).toBeVisible();
    await expect(page.getByText('انگشتر نقره حمیدیان').first()).toBeVisible();
    await page.getByRole('link', { name: 'ثبت سفارش' }).first().click();
  });

  await test.step('create the order and leave for the gateway', async () => {
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByText('آدرس پیش‌فرض')).toBeVisible();
    await page.getByRole('button', { name: 'ثبت سفارش و پرداخت' }).click();

    await expect(page).toHaveURL(
      `${mockApiOrigin}/gateway?attemptId=40000000-0000-4000-8000-000000000001`,
    );
    await expect(page.getByRole('heading', { name: 'درگاه آزمایشی پرداخت' })).toBeVisible();
  });

  await test.step('return through the real callback and verify the paid order', async () => {
    await page.getByRole('link', { name: 'تأیید پرداخت کم‌مبلغ' }).click();

    await expect(page).toHaveURL(/\/payment\/result\?status=success&orderId=/);
    await expect(page.getByText('پرداخت موفق')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'خرید شما با موفقیت تکمیل شد' })).toBeVisible();
    await expect(page.getByText('HS-E۲E-۱۰۰۱', { exact: true }).first()).toBeVisible();

    await page.getByRole('link', { name: 'مشاهده جزئیات سفارش' }).click();
    await expect(page).toHaveURL(/\/account\/orders\/30000000-0000-4000-8000-000000000001$/);
    await expect(page.getByRole('heading', { name: 'جزئیات سفارش' })).toBeVisible();
    await expect(page.getByText('پرداخت‌شده').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'روند سفارش' })).toBeVisible();
  });
});
