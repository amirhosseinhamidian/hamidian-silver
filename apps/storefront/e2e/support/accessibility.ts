import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

import type { Page, TestInfo } from '@playwright/test';

export async function expectNoWcagViolations(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  if (results.violations.length > 0) {
    await testInfo.attach('accessibility-scan-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });
  }

  expect(results.violations).toEqual([]);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(1);
}

export async function waitForClientHydration(page: Page) {
  await page.waitForLoadState('load');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const finish = () => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        };

        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(finish, { timeout: 1_000 });
          return;
        }

        window.setTimeout(finish, 0);
      }),
  );
}
