import { ConfigService } from '@nestjs/config';
import { emptyObservation } from '../src/modules/seo/audit/seo-audit-crawl';
import { SeoIssueDeliveryWorker } from '../src/modules/seo/issues/seo-issue-delivery.worker';
import { SeoIssueService } from '../src/modules/seo/issues/seo-issue.service';
import { createIsolatedTestDatabase } from './support/isolated-test-database';

jest.setTimeout(50_000);

it('deduplicates issues and deliveries, keeps an ambiguous send, and audits resolution and recurrence', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const origin = 'https://hamidian.shop';
  const property = 'sc-domain:hamidian.shop';
  const config = new ConfigService({
    STOREFRONT_PUBLIC_ORIGIN: origin,
    ADMIN_APP_ORIGIN: 'https://admin.hamidian.shop',
    SEO_ISSUES_TELEGRAM_ENABLED: true,
    TELEGRAM_BOT_TOKEN: 'fixture',
  });
  const issues = new SeoIssueService(db, config, { property });
  const send = jest.fn().mockRejectedValueOnce(new Error('network'));
  const worker = new SeoIssueDeliveryWorker(db, config, { send }, issues);
  const start = new Date('2026-11-26T12:00:00Z');
  const path = '/products/ring';

  const addAudit = async (minutes: number, present: boolean) => {
    const date = new Date(start.getTime() + minutes * 60_000);
    await db.seoAuditRun.create({
      data: {
        origin,
        createdAt: date,
        finishedAt: date,
        ruleVersion: 1,
        sitemapChecked: true,
        checks: {
          create: {
            path,
            priority: 1,
            source: 'PRODUCT',
            checkedAt: date,
            inSitemap: true,
            observation: {
              ...emptyObservation(path),
              status: present ? 404 : 200,
              html: !present,
              canonicals: present ? [] : [origin + path],
            },
            issues: present ? [{ code: 'BUYABLE_PRODUCT_NOT_FOUND', evidence: ['HTTP 404'] }] : [],
          },
        },
      },
    });
    return date;
  };

  try {
    const role = await db.role.upsert({
      where: { code: 'ADMIN' },
      create: { code: 'ADMIN', name: 'Administrator' },
      update: {},
    });
    for (const code of ['settings.read', 'settings.write']) {
      const permission = await db.permission.upsert({
        where: { code },
        create: { code, name: code },
        update: {},
      });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
    const user = await db.user.create({
      data: {
        phone: '+989121000001',
        firstName: 'مدیر',
        roles: { create: { roleId: role.id } },
      },
    });
    await db.adminMessageRecipient.create({ data: { userId: user.id, telegramChatId: '1234' } });
    const observedAt = await addAudit(0, true);
    const scans = await Promise.all([issues.scan(observedAt), issues.scan(observedAt)]);
    expect(scans.reduce((total, { changed }) => total + changed, 0)).toBe(1);
    const first = (await issues.list(1)).items[0];
    expect(first).toMatchObject({ status: 'OPEN', severity: 'CRITICAL', active: true });
    expect(await db.seoIssueDelivery.count()).toBe(1);
    await Promise.all([worker.tick(), worker.tick()]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await db.seoIssueDelivery.findFirst()).toMatchObject({ status: 'UNKNOWN' });
    await worker.tick();
    expect(send).toHaveBeenCalledTimes(1);

    const assigned = await issues.update(first.id, user.id, {
      revision: first.revision,
      ownerId: user.id,
      status: 'IN_PROGRESS',
      note: 'شاهد بررسی',
    });
    expect(assigned).toMatchObject({ issue: { owner: { id: user.id }, status: 'IN_PROGRESS' } });
    await expect(
      issues.update(first.id, user.id, { revision: first.revision, status: 'RESOLVED' }),
    ).rejects.toMatchObject({ status: 409 });
    await issues.update(first.id, user.id, {
      revision: assigned.issue.revision,
      status: 'RESOLVED',
      note: 'رفع شد',
    });
    expect(await issues.scan(observedAt)).toEqual({ changed: 0 });
    await issues.scan(await addAudit(60, false));
    expect((await issues.detail(first.id)).issue).toMatchObject({
      active: false,
      status: 'RESOLVED',
    });
    await issues.scan(await addAudit(120, true));
    const returned = await issues.detail(first.id);
    expect(returned.issue).toMatchObject({ active: true, status: 'OPEN' });
    expect(returned.events.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(['DETECTED', 'UPDATED', 'CLEARED', 'RETURNED']),
    );
    expect(await db.seoIssue.count()).toBe(1);
    expect(await db.seoIssueDelivery.count()).toBe(1);

    const integration = await db.seoIntegration.create({ data: { property } });
    const tracked = await db.seoUrlInventory.create({
      data: {
        integrationId: integration.id,
        urlKey: '0'.repeat(64),
        reportedUrl: origin + path,
        reportedPath: path,
        normalizedPath: path,
      },
    });
    await db.seoPerformanceDaily.createMany({
      data: Array.from({ length: 14 }, (_, index) => ({
        integrationId: integration.id,
        urlId: tracked.id,
        dimensionKey: 'a'.repeat(64),
        metricDate: new Date(Date.UTC(2026, 10, 10 + index)),
        sourceVersion: new Date('2026-11-26'),
        searchType: 'web',
        scope: 'PAGE',
        aggregation: 'byPage',
        impressions: index < 7 ? 100 : 20,
        clicks: index < 7 ? 20 : 8,
      })),
    });
    expect(await issues.scan(start)).toEqual({ changed: 2 });
    const reports = (await issues.list(1)).items.filter(({ rule }) => rule.startsWith('SEARCH_'));
    expect(reports.map(({ rule }) => rule).sort()).toEqual([
      'SEARCH_CLICKS_DROP',
      'SEARCH_IMPRESSIONS_DROP',
    ]);
    expect(reports.every(({ evidence }) => evidence.sourceHref.startsWith('/seo?kind=page&'))).toBe(
      true,
    );
    expect(await issues.scan(start)).toEqual({ changed: 0 });
  } finally {
    await close();
  }
});
