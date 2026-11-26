import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { SeoAuditService } from '../src/modules/seo/audit/seo-audit.service';
import { createIsolatedTestDatabase } from './support/isolated-test-database';

jest.setTimeout(60_000);

it('resumes leased audits, retries upstream failure, and preserves evidence across runs', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const origin = 'https://audit-fixture.example';
  const productPath = '/products/ring';
  const audits = () =>
    new SeoAuditService(db, new ConfigService({ STOREFRONT_PUBLIC_ORIGIN: origin }));
  const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html' } });
  let sitemapAttempts = 0;
  let availability = 0;
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    expect(url.origin).toBe(origin);
    const path = url.pathname + url.search;
    if (path === '/sitemap.xml') {
      if (++sitemapAttempts === 1) return new Response(null, { status: 503 });
      return new Response(
        `<urlset><url><loc>${origin}${productPath}</loc></url><url><loc>${origin}/guide/old</loc></url></urlset>`,
        { headers: { 'content-type': 'text/xml' } },
      );
    }
    if (path === productPath) return new Response(null, { status: 404 });
    if (path === '/guide/old')
      return new Response(null, { status: 301, headers: { location: '/guide/new' } });
    if (path === '/guide/new') return html('<meta name="robots" content="noindex, follow">');
    if (path === '/') return html(`<a href="/products">shop</a><a href="${productPath}">ring</a>`);
    if (path === '/products') return html('<a href="?page=2">next page</a>');
    if (path === '/products?page=2') {
      availability++;
      return html(
        '<title>Second page</title><meta name="description" content="Items"><link rel="canonical" href="/products?page=2">',
      );
    }
    return html('<meta name="robots" content="noindex, follow">');
  });

  try {
    const warehouse = await db.warehouse.create({
      data: { code: 'seo-audit', name: 'Audit', isDefault: true },
    });
    const product = await db.product.create({
      data: {
        name: 'Ring',
        slug: 'ring',
        status: 'ACTIVE',
        salePriceToman: 10000,
        variants: { create: { sku: 'seo-audit-ring', salePriceToman: 10000 } },
      },
      include: { variants: true },
    });
    await db.inventory.create({
      data: { warehouseId: warehouse.id, variantId: product.variants[0].id, onHand: 1 },
    });

    const firstWorker = audits();
    const { id } = await firstWorker.start();
    await expect(audits().start()).rejects.toThrow('already queued or running');
    await firstWorker.tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await firstWorker.tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await db.seoAuditCheck.updateMany({
      where: { runId: id },
      data: { nextAttemptAt: new Date(0) },
    });
    await db.seoAuditRun.update({
      where: { id },
      data: {
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() + 60_000),
        pauseUntil: null,
      },
    });
    await audits().tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await db.seoAuditRun.update({ where: { id }, data: { leaseUntil: new Date(0) } });
    await Promise.all([audits().tick(), audits().tick()]);
    expect(sitemapAttempts).toBe(2);

    const finish = async (runId: string) => {
      const worker = audits();
      for (let i = 0; i < 15; i++) {
        const result = await worker.overview(runId);
        if (result.run?.finishedAt) return result;
        await worker.tick();
      }
      throw new Error('Audit did not finish');
    };
    const first = await finish(id);
    expect(first.run).toMatchObject({ sitemapChecked: true, ruleVersion: 1 });
    expect(first.checks.find(({ path }) => path === productPath)).toMatchObject({
      inSitemap: true,
      observation: { status: 404 },
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'BUYABLE_PRODUCT_NOT_FOUND', state: 'NEW' }),
        expect.objectContaining({
          code: 'BROKEN_INTERNAL_LINK',
          state: 'NEW',
          evidence: expect.arrayContaining(['/']),
        }),
      ]),
    });
    expect(first.checks.find(({ path }) => path === '/guide/old')).toMatchObject({
      observation: { redirects: [{ status: 301, to: '/guide/new' }] },
      issues: expect.arrayContaining([expect.objectContaining({ code: 'SITEMAP_NOINDEX' })]),
    });
    expect(first.checks.find(({ path }) => path === '/products?page=2')?.issues).toEqual([]);
    expect(availability).toBe(1);

    const second = await finish((await audits().start()).id);
    expect(second.history).toHaveLength(2);
    expect(second.checks.find(({ path }) => path === productPath)?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'BUYABLE_PRODUCT_NOT_FOUND', state: 'EXISTING' }),
      ]),
    );
  } finally {
    fetchMock.mockRestore();
    await close();
  }
});
