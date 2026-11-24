import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { formatTehranDate } from '../src/modules/campaigns/campaign-calendar';
import { CampaignLandingsService } from '../src/modules/campaigns/campaign-landings.service';
import { CampaignOperationsCenterService } from '../src/modules/campaigns/campaign-operations-center.service';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import { FestivalDesignService } from '../src/modules/campaigns/festival-design.service';
import type { FestivalDesignDto } from '../src/modules/campaigns/dto/festival-design.dto';
import type { CampaignLandingDraftDto } from '../src/modules/campaigns/dto/campaign-landing.dto';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';

it('publishes only qualifying products, limits banner placements and archives a recurring campaign', async () => {
  const config = new ConfigService();
  const db = new PrismaService(config);
  const media = new PublicMediaUrlService(config);
  const catalog = new CatalogService(db, media);
  const operations = new CampaignOperationsCenterService(db, catalog);
  const festivals = new FestivalDesignService(db, catalog, media);
  const landings = new CampaignLandingsService(db, catalog, media, festivals);
  const campaigns = new CampaignsService(db, media, landings);
  const slug = `landing-${randomUUID()}`;
  const phone = `+0${BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 12)}`)}`;
  const now = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const end = new Date(now.valueOf() + 10 * 60_000);
  const bannerEnd = new Date(now.valueOf() + 5 * 60_000);
  try {
    const owner = await db.user.create({ data: { phone } });
    const primary =
      (await db.warehouse.findFirst({
        where: { isDefault: true, isActive: true, deletedAt: null },
        select: { id: true },
      })) ??
      (await db.warehouse.create({
        data: { code: slug, name: 'Landing checkout fixture', isDefault: true },
      }));
    const backup = await db.warehouse.create({
      data: { code: `${slug}-backup`, name: 'Remote inventory fixture' },
    });
    const category = await db.category.create({ data: { name: 'جواهرات', slug } });
    const child = await db.category.create({
      data: { name: 'انگشتر', slug: `${slug}-rings`, parentId: category.id },
    });
    const brand = await db.brand.create({ data: { name: 'برند آزمون', slug } });
    const attribute = `${slug}-style`;
    await db.catalogAttributeDefinition.create({
      data: {
        code: attribute,
        versions: {
          create: {
            version: 1,
            kind: 'SELECT',
            source: 'MANUAL',
            unit: 'NONE',
            label: 'سبک',
            categoryIds: [category.id],
            options: [{ code: 'classic', label: 'کلاسیک' }],
            legacyMappings: [],
          },
        },
      },
    });
    const createProduct = async (
      label: string,
      warehouseId: string,
      price: number,
      withAttribute = true,
    ) => {
      const product = await db.product.create({
        data: {
          name: label,
          slug: `${slug}-${label}`,
          status: 'ACTIVE',
          brandId: brand.id,
          salePriceToman: price,
          categories: { create: { categoryId: child.id } },
          variants: {
            create: {
              sku: `${slug}-${label}`,
              inventories: { create: { warehouseId, onHand: 3 } },
            },
          },
        },
      });
      if (withAttribute) {
        await db.catalogProductAttributeValue.create({
          data: {
            productId: product.id,
            attributeCode: attribute,
            definitionVersion: 1,
            revision: 1,
            value: { optionCode: 'classic' },
          },
        });
      }
      return product;
    };
    const ring = await createProduct('ring', primary.id, 800_000);
    const chain = await createProduct('chain', primary.id, 900_000);
    const remote = await createProduct('remote', backup.id, 800_000);
    await createProduct('expensive', primary.id, 1_250_000);
    await createProduct('unmatched', primary.id, 800_000, false);

    const created = await campaigns.create(
      {
        slug,
        trackingId: slug,
        trackingLabel: slug,
        name: 'کمپین آزمایشی',
        goal: 'مجموعهٔ انگشتر',
        channel: 'email',
        budgetToman: 0,
        allProducts: true,
        productSlugs: [],
        categorySlugs: [],
        startsTehran: formatTehranDate(new Date(now.valueOf() - 120_000)),
        endsTehran: formatTehranDate(end),
        message: 'انگشترهای منتخب',
        bannerEnabled: true,
        bannerPriority: 20,
      },
      owner.id,
    );
    const assets = await Promise.all(
      ['gif', 'webp', 'png'].map((extension) =>
        db.media.create({
          data: {
            storageKey: `catalog/${slug}-${extension}.${extension}`,
            mimeType: `image/${extension}`,
            sizeBytes: 128,
            altText: 'تصویر کمپین آزمایشی',
          },
        }),
      ),
    );
    const input = {
      slug,
      seoMode: 'RECURRING',
      collectionMode: 'FILTERED',
      title: 'مجموعهٔ مناسبتی',
      story: 'انگشترهای کلاسیک برای هدیه.',
      filters: {
        categories: [category.slug],
        brands: [brand.slug],
        maxPriceToman: 1_000_000,
        minimumQuantity: 2,
        attributes: [{ code: attribute, values: ['classic'] }],
      },
      manualProductSlugs: [],
      placements: [
        { slot: 'HOME', priority: 30 },
        {
          slot: 'CATEGORY',
          priority: 30,
          targetSlug: child.slug,
          endsTehran: formatTehranDate(bannerEnd),
        },
        { slot: 'PRODUCT', priority: 30, targetSlug: ring.slug },
        {
          slot: 'COUNTDOWN',
          priority: 40,
          endsTehran: formatTehranDate(bannerEnd),
          appearance: {
            mediaId: assets[0].id,
            mobileMediaId: assets[1].id,
            stillMediaId: assets[2].id,
            desktopHeight: 120,
            mobileHeight: 64,
            textColor: '#ffffff',
          },
        },
        { slot: 'NAVIGATION', priority: 40, appearance: { navigationEffect: 'ANIMATED' } },
      ],
    } satisfies CampaignLandingDraftDto;

    await expect(landings.preview(created.id, input)).resolves.toEqual({ total: 2 });
    await expect(
      landings.preview(created.id, {
        ...input,
        collectionMode: 'MANUAL',
        manualProductSlugs: [remote.slug, ring.slug],
      }),
    ).resolves.toEqual({ total: 1 });
    await expect(
      landings.preview(created.id, {
        ...input,
        placements: [{ slot: 'COUNTDOWN', priority: 0, appearance: { mediaId: assets[0].id } }],
      }),
    ).rejects.toThrow('static fallback');
    const saved = await landings.save(created.id, { ...input, expectedRevision: 1 }, owner.id);
    await expect(landings.publicLanding(slug, 1, now)).rejects.toThrow('not found');
    await expect(
      landings.save(created.id, { ...input, expectedRevision: 1 }, owner.id),
    ).rejects.toThrow('current draft');
    const editor = await festivals.editor(created.id);
    const design = {
      schemaVersion: 1,
      theme: editor.presets[0].theme,
      sections: [
        {
          kind: 'HERO',
          enabled: true,
          title: 'جشنواره',
          layout: 'GRID',
          slides: [{ mediaId: assets[0].id, stillMediaId: assets[2].id, title: 'هدیهٔ نقره' }],
        },
        {
          kind: 'CATEGORIES',
          enabled: true,
          title: 'انتخاب دسته',
          layout: 'GRID',
          slugs: [child.slug],
        },
        {
          kind: 'FAQ',
          enabled: true,
          title: 'پرسش‌ها',
          layout: 'GRID',
          startsTehran: formatTehranDate(bannerEnd),
          entries: [{ title: 'زمان پایان', body: 'پایان در تاریخ اعلام‌شده' }],
        },
        { kind: 'PRODUCTS', enabled: true, title: 'همهٔ محصولات', layout: 'GRID' },
      ],
    } satisfies FestivalDesignDto;
    await expect(festivals.preview(created.id, design)).resolves.toMatchObject({
      products: { total: 2 },
      design: {
        sections: expect.arrayContaining([
          {
            kind: 'FAQ',
            title: 'پرسش‌ها',
            layout: 'GRID',
            entries: [{ title: 'زمان پایان', body: 'پایان در تاریخ اعلام‌شده' }],
          },
        ]),
      },
    });
    const firstDesign = await festivals.save(
      created.id,
      { ...design, expectedRevision: saved.revision },
      owner.id,
    );
    await expect(
      festivals.save(created.id, { ...design, expectedRevision: saved.revision }, owner.id),
    ).rejects.toThrow('current draft');
    const secondDesign = await festivals.save(
      created.id,
      {
        ...design,
        theme: editor.presets[1].theme,
        expectedRevision: firstDesign.revision,
      },
      owner.id,
    );
    const restoredDesign = await festivals.restore(
      created.id,
      secondDesign.revision,
      firstDesign.revision,
      owner.id,
    );
    expect(restoredDesign.design?.theme).toEqual(design.theme);
    expect(restoredDesign.history.map(({ revision }) => revision)).toEqual([
      restoredDesign.revision,
      secondDesign.revision,
      firstDesign.revision,
    ]);
    expect(
      await db.festivalDesignAsset.count({
        where: { campaignId: created.id, mediaId: assets[0].id },
      }),
    ).toBe(3);
    const move = (action: 'APPROVE' | 'SCHEDULE', expectedRevision: number) =>
      campaigns.transition(
        created.id,
        { action, expectedRevision, requestId: randomUUID() },
        owner.id,
      );
    const selectedIds = [ring.id, chain.id];
    await db.product.updateMany({
      where: { id: { in: selectedIds } },
      data: { salePriceToman: 1_100_000 },
    });
    await expect(move('APPROVE', restoredDesign.revision)).rejects.toThrow('no sellable products');
    await db.product.updateMany({
      where: { id: { in: selectedIds } },
      data: { salePriceToman: 850_000 },
    });
    const approved = await move('APPROVE', restoredDesign.revision);
    await move('SCHEDULE', approved.revision);
    await campaigns.advance(now);
    await expect(operations.read(created.id, {}, false, now)).resolves.toMatchObject({
      publication: 'LIVE',
      landingSlug: slug,
    });

    const page = await landings.publicLanding(slug, 1, now);
    expect(page).toMatchObject({ active: true, products: { total: 2 } });
    expect(page.products.items.map(({ id }) => id).sort()).toEqual([...selectedIds].sort());
    expect(page.products.items.every(({ salePriceToman }) => salePriceToman === 850_000)).toBe(
      true,
    );
    expect(page.design?.sections.map(({ kind }) => kind)).toEqual([
      'HERO',
      'CATEGORIES',
      'PRODUCTS',
    ]);
    expect(page.design?.refreshAt).toBe(bannerEnd.toISOString());
    expect(page.design?.filterCategories).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: child.slug, count: 2 })]),
    );
    expect(page.design?.filterBrands).toEqual([
      expect.objectContaining({ value: brand.slug, count: 2 }),
    ]);
    expect(page.design?.sections.find(({ kind }) => kind === 'CATEGORIES')?.categories).toEqual([
      expect.objectContaining({ slug: child.slug }),
    ]);
    await expect(landings.publicLanding(slug, 1, bannerEnd)).resolves.toMatchObject({
      design: { sections: expect.arrayContaining([expect.objectContaining({ kind: 'FAQ' })]) },
    });
    const filtered = await landings.publicLanding(slug, 1, now, { maxPriceToman: 800_000 }, true);
    expect(filtered.products.total).toBe(0);
    expect(filtered.design).toBeUndefined();
    await expect(landings.publicLanding(slug, 2, now)).rejects.toThrow('page not found');
    await expect(campaigns.publicBanner(now)).resolves.toMatchObject({
      banner: { ctaPath: `/campaigns/${slug}` },
    });
    await expect(landings.placement('CATEGORY', child.slug, now)).resolves.toMatchObject({
      banner: { endsAt: bannerEnd.toISOString() },
    });
    await expect(landings.placement('CATEGORY', category.slug, now)).resolves.toBeNull();
    await expect(landings.placement('CATEGORY', child.slug, bannerEnd)).resolves.toBeNull();
    await expect(landings.placement('PRODUCT', ring.slug, now)).resolves.toMatchObject({
      banner: { ctaPath: `/campaigns/${slug}` },
    });
    await expect(landings.placement('COUNTDOWN', undefined, now)).resolves.toMatchObject({
      banner: {
        campaignId: created.id,
        media: { id: assets[0].id },
        mobileMedia: { id: assets[1].id },
        stillMedia: { id: assets[2].id },
        desktopHeight: 120,
        mobileHeight: 64,
      },
    });
    await expect(landings.placement('COUNTDOWN', undefined, bannerEnd)).resolves.toBeNull();
    await expect(landings.placement('NAVIGATION', undefined, now)).resolves.toMatchObject({
      banner: { campaignId: created.id, navigationEffect: 'ANIMATED' },
    });
    expect((await campaigns.publicActivity(now)).activeIds).toContain(created.id);
    await db.campaign.update({ where: { id: created.id }, data: { status: 'PAUSED' } });
    await expect(landings.placement('NAVIGATION', undefined, now)).resolves.toBeNull();
    expect((await campaigns.publicActivity(now)).activeIds).not.toContain(created.id);
    await db.campaign.update({ where: { id: created.id }, data: { status: 'ACTIVE' } });
    await expect(landings.sitemap(now)).resolves.toMatchObject({
      entries: expect.arrayContaining([expect.objectContaining({ slug })]),
    });

    await db.product.updateMany({
      where: { id: { in: selectedIds } },
      data: { salePriceToman: 1_100_000 },
    });
    await expect(landings.publicLanding(slug, 1, now)).resolves.toMatchObject({
      active: true,
      products: { total: 0, items: [] },
    });
    await expect(landings.placement('PRODUCT', ring.slug, now)).resolves.toBeNull();
    await expect(operations.read(created.id, {}, false, now)).resolves.toMatchObject({
      publication: 'EMPTY',
    });
    expect((await landings.sitemap(now)).entries.some((entry) => entry.slug === slug)).toBe(false);
    await campaigns.advance(end);
    await expect(landings.publicLanding(slug, 1, end)).resolves.toMatchObject({
      active: false,
      seoMode: 'RECURRING',
      products: { total: 0 },
    });
  } finally {
    try {
      await db.$transaction([
        db.campaignPlacement.deleteMany({ where: { landing: { slug } } }),
        db.campaignLanding.deleteMany({ where: { slug } }),
        db.campaignRevision.deleteMany({ where: { campaign: { trackingId: slug } } }),
        db.media.deleteMany({ where: { storageKey: { startsWith: `catalog/${slug}-` } } }),
        db.campaign.deleteMany({ where: { trackingId: slug } }),
        db.campaignLinkIdentity.deleteMany({ where: { id: slug } }),
        db.catalogProductAttributeValue.deleteMany({ where: { attributeCode: `${slug}-style` } }),
        db.catalogAttributeVersion.deleteMany({ where: { attributeCode: `${slug}-style` } }),
        db.catalogAttributeDefinition.deleteMany({ where: { code: `${slug}-style` } }),
        db.inventory.deleteMany({ where: { variant: { sku: { startsWith: `${slug}-` } } } }),
        db.productVariant.deleteMany({ where: { sku: { startsWith: `${slug}-` } } }),
        db.productCategory.deleteMany({ where: { product: { slug: { startsWith: `${slug}-` } } } }),
        db.product.deleteMany({ where: { slug: { startsWith: `${slug}-` } } }),
        db.warehouse.deleteMany({ where: { code: { in: [slug, `${slug}-backup`] } } }),
        db.category.deleteMany({ where: { slug: `${slug}-rings` } }),
        db.category.deleteMany({ where: { slug } }),
        db.brand.deleteMany({ where: { slug } }),
        db.user.deleteMany({ where: { phone } }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 30_000);
