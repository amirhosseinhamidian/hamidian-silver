import { expect, test } from '@playwright/test';

test('links counted subcategories, renders their breadcrumbs and follows a merged category URL', async ({
  page,
}) => {
  await page.goto('/categories/rings');
  const child = page
    .getByRole('navigation', { name: 'زیرمجموعه‌های انگشتر' })
    .getByRole('link', { name: /انگشتر زنانه.*۱ محصول/ });
  await expect(child).toHaveAttribute('href', '/categories/women-rings');
  await child.click();
  await expect(page).toHaveURL(/\/categories\/women-rings$/);
  const breadcrumbs = page.getByRole('navigation', { name: 'مسیر صفحه' });
  await expect(breadcrumbs.getByRole('link', { name: 'انگشتر', exact: true })).toHaveAttribute(
    'href',
    '/categories/rings',
  );
  await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('انگشتر زنانه');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'http://localhost:4310/categories/women-rings',
  );

  await page.goto('/categories/rings-legacy');
  await expect(page).toHaveURL(/\/categories\/rings$/);
  await expect(page.getByRole('heading', { name: 'انگشتر', level: 1, exact: true })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'http://localhost:4310/categories/rings',
  );
});
