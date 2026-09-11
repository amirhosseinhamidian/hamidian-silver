import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow, expectNoWcagViolations } from './support/accessibility';

test.describe('storefront responsive accessibility', () => {
  test('supports skip navigation and restores dialog focus', async ({ page }, testInfo) => {
    await page.goto('/products/silver-ring');
    await expect(page.getByRole('heading', { name: 'انگشتر نقره حمیدیان' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoWcagViolations(page, testInfo);

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'رفتن به محتوای اصلی' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    const authTrigger = page.getByRole('button', { name: 'ورود یا ثبت‌نام' }).first();
    await authTrigger.click();
    const authDialog = page.getByRole('dialog', { name: 'ورود یا ثبت‌نام' });
    await expect(authDialog).toBeVisible();
    await expect
      .poll(() => authDialog.evaluate((dialog) => dialog.contains(document.activeElement)))
      .toBe(true);
    for (let tabIndex = 0; tabIndex < 8; tabIndex += 1) {
      await page.keyboard.press('Tab');
      expect(await authDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(
        true,
      );
    }
    await expectNoWcagViolations(page, testInfo);

    await page.keyboard.press('Escape');
    await expect(authDialog).toBeHidden();
    await expect(authTrigger).toBeFocused();
  });

  test('traps and restores focus in the mobile navigation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Mobile Chrome', 'Mobile navigation is hidden here.');

    await page.goto('/products/silver-ring');
    const menuTrigger = page.getByRole('button', { name: 'باز کردن منوی موبایل' });
    await menuTrigger.click();

    const menuDialog = page.getByRole('dialog', { name: 'منوی فروشگاه' });
    await expect(menuDialog).toBeVisible();
    await expect
      .poll(() => menuDialog.evaluate((dialog) => dialog.contains(document.activeElement)))
      .toBe(true);
    for (let tabIndex = 0; tabIndex < 12; tabIndex += 1) {
      await page.keyboard.press('Tab');
      expect(await menuDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(
        true,
      );
    }
    await expectNoWcagViolations(page, testInfo);

    await page.keyboard.press('Escape');
    await expect(menuDialog).toBeHidden();
    await expect(menuTrigger).toBeFocused();
  });
});
