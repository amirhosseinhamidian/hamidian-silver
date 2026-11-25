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
import { PromotionsService } from '../src/modules/promotions/promotions.service';

it('publishes only qualifying products, limits banner placements and archives a recurring campaign', async () => {
  const config = new ConfigService();
  const db = new PrismaService(config);
  const media = new PublicMediaUrlService(config);
  const catalog = new CatalogService(db, media, undefined, new PromotionsService(db));
  const operations = new CampaignOperationsCenterService(db, catalog);
  const festivals = new FestivalDesignService(db, catalog, media);
  const landings = new CampaignLandingsService(db, catalog, media, festivals);
  const campaigns = new CampaignsService(db, media, landings);
  const slug = `landing-${randomUUID()}`;
  const secondarySlug = `${slug}-secondary`;
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
    await db.productMedia.create({
      data: { productId: ring.id, mediaId: assets[1].id, isPrimary: true },
    });
    await db.productVariant.update({
      where: { sku: `${slug}-ring` },
      data: { sku: `${slug}-ring-sku` },
    });
    await expect(
      campaigns.selectProducts({ q: `${slug}-ring-sku`, stock: 'in-stock' }),
    ).resolves.toMatchObject({
      items: [
        {
          id: ring.id,
          defaultPriceToman: 800_000,
          availableQuantity: 3,
          imageAlt: 'تصویر کمپین آزمایشی',
        },
      ],
      hasMore: false,
    });
    await expect(
      campaigns.selectProducts({ q: slug, category: category.slug, categoryMode: 'direct' }),
    ).resolves.toMatchObject({ items: [] });
    await expect(
      campaigns.selectProducts({
        q: slug,
        category: category.slug,
        brand: brand.slug,
        stock: 'out-of-stock',
      }),
    ).resolves.toMatchObject({ items: [{ id: remote.id, availableQuantity: 0 }] });
    await expect(
      campaigns.selectProducts({ selected: [ring.slug, ring.slug], campaignId: created.id }),
    ).resolves.toMatchObject({ items: [{ id: ring.id }], hasMore: false });
    await expect(campaigns.selectProducts({ scope: 'campaign' })).rejects.toThrow('identifier');
    await db.campaign.update({
      where: { id: created.id },
      data: { allProducts: false, productIds: [ring.id], categoryIds: [child.id] },
    });
    await expect(
      campaigns.selectProducts({ q: ring.id, campaignId: created.id, scope: 'campaign' }),
    ).resolves.toMatchObject({ items: [{ id: ring.id }] });
    await db.campaign.update({
      where: { id: created.id },
      data: { allProducts: true, productIds: [], categoryIds: [] },
    });
    await expect(campaigns.selectionTaxonomy()).resolves.toMatchObject({
      categories: expect.arrayContaining([
        expect.objectContaining({ id: category.id, directProductCount: 0, subtreeProductCount: 5 }),
      ]),
    });
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
            display: {
              message: 'پیشنهاد نوروزی',
              backgroundColor: '#251a30',
              gradientColor: '#432e51',
              mediaFit: 'CONTAIN',
              overlay: 'SOFT',
              ctaStyle: 'SOLID',
              ctaPath: '/products',
              ctaLabel: 'دیدن محصولات',
              showCountdown: false,
            },
          },
        },
        {
          slot: 'NAVIGATION',
          priority: 40,
          appearance: {
            navigationEffect: 'ANIMATED',
            display: { useTheme: true, title: 'نوروز', icon: 'STAR' },
          },
        },
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
    expect(
      saved.landing?.placements.find(({ slot }) => slot === 'COUNTDOWN')?.appearance?.display,
    ).toEqual(input.placements.find(({ slot }) => slot === 'COUNTDOWN')?.appearance?.display);
    await expect(campaigns.selectCollections(slug)).resolves.toMatchObject({
      items: [{ id: created.id, slug, name: input.title }],
    });
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
        {
          kind: 'PICKS',
          enabled: true,
          title: 'انتخاب مدیر',
          description: '  انتخاب‌های این هفته  ',
          highlighted: true,
          layout: 'STRIP',
          itemLimit: 1,
          slugs: [remote.slug, chain.slug, ring.slug],
          artwork: {
            mediaId: assets[0].id,
            mobileMediaId: assets[1].id,
            stillMediaId: assets[2].id,
          },
        },
        { kind: 'PRODUCTS', enabled: true, title: 'همهٔ محصولات', layout: 'GRID' },
      ],
    } satisfies FestivalDesignDto;
    await expect(
      festivals.preview(created.id, {
        ...design,
        sections: design.sections.map((section) =>
          section.kind === 'PICKS'
            ? { ...section, artwork: { mobileMediaId: assets[1].id } }
            : section,
        ),
      }),
    ).rejects.toThrow('Section artwork needs a desktop image');
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
    await db.campaign.update({ where: { id: created.id }, data: { budgetToman: 10_000_000 } });
    await db.campaignPromotion.create({
      data: {
        campaignId: created.id,
        actorUserId: owner.id,
        kind: 'PERCENT',
        value: 1_000,
        minSubtotalToman: 0,
        maxDiscountToman: 500_000,
        maxDiscountBps: 1_000,
        priority: 10,
      },
    });
    await db.campaignQuota.create({
      data: { campaignId: created.id, productId: ring.id, limit: 5 },
    });
    const draftPreview = await landings.previewDesign(created.id, {
      ...design,
      landing: {
        ...input,
        title: 'عنوان ذخیره‌نشده',
        collectionMode: 'MANUAL',
        manualProductSlugs: [ring.slug],
        placements: [
          {
            slot: 'NAVIGATION',
            priority: 40,
            appearance: { display: { title: 'منوی ذخیره‌نشده', useTheme: true } },
          },
        ],
      },
    });
    expect(draftPreview).toMatchObject({
      title: 'عنوان ذخیره‌نشده',
      navigation: {
        display: { title: 'منوی ذخیره‌نشده', backgroundColor: design.theme.background },
      },
      products: {
        items: [
          {
            id: ring.id,
            campaignOffer: { price: { finalToman: 720_000 } },
            campaignQuota: { limit: 5 },
          },
        ],
      },
    });
    expect(draftPreview.announcement).toBeUndefined();
    await expect(landings.editor(created.id)).resolves.toMatchObject({
      revision: saved.revision,
      landing: { title: input.title },
    });
    await expect(landings.publicLanding(slug, 1, now)).rejects.toThrow('not found');
    await db.campaignQuota.deleteMany({ where: { campaignId: created.id } });
    await db.campaignPromotion.delete({ where: { campaignId: created.id } });
    await db.campaign.update({ where: { id: created.id }, data: { budgetToman: 0 } });
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
      'PICKS',
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
    expect(page.design?.sections.find(({ kind }) => kind === 'PICKS')).toMatchObject({
      description: 'انتخاب‌های این هفته',
      highlighted: true,
      layout: 'STRIP',
      artwork: {
        media: { id: assets[0].id },
        mobileMedia: { id: assets[1].id },
        stillMedia: { id: assets[2].id },
      },
      products: [{ id: chain.id }],
    });
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
    await db.campaignLinkIdentity.create({ data: { id: secondarySlug, campaign: secondarySlug } });
    const secondary = await db.campaign.create({
      data: {
        slug: secondarySlug,
        name: secondarySlug,
        goal: 'فروش',
        message: 'جشنوارهٔ دوم',
        channel: 'festival',
        ownerId: owner.id,
        trackingId: secondarySlug,
        kind: 'FESTIVAL',
        status: 'ACTIVE',
        bannerEnabled: true,
        allProducts: true,
        budgetToman: 0,
        startsAt: now,
        endsAt: end,
        landing: {
          create: {
            slug: secondarySlug,
            seoMode: 'TEMPORARY',
            title: secondarySlug,
            story: 'جشنوارهٔ دوم',
            collectionMode: 'MANUAL',
            manualProductIds: [ring.id],
            filters: {},
            placements: {
              create: [
                { slot: 'COUNTDOWN', priority: 30 },
                { slot: 'NAVIGATION', priority: 30 },
              ],
            },
          },
        },
      },
    });
    await expect(landings.placement('COUNTDOWN', undefined, now)).resolves.toMatchObject({
      banner: {
        campaignId: created.id,
        media: { id: assets[0].id },
        mobileMedia: { id: assets[1].id },
        stillMedia: { id: assets[2].id },
        desktopHeight: 120,
        mobileHeight: 64,
        message: 'پیشنهاد نوروزی',
        ctaPath: '/products',
        ctaLabel: 'دیدن محصولات',
        endsAt: bannerEnd.toISOString(),
        countdownEndsAt: end.toISOString(),
        display: { mediaFit: 'CONTAIN', overlay: 'SOFT', ctaStyle: 'SOLID', showCountdown: false },
      },
    });
    await expect(landings.placement('COUNTDOWN', undefined, bannerEnd)).resolves.toMatchObject({
      banner: { campaignId: secondary.id },
    });
    await expect(landings.placement('NAVIGATION', undefined, now)).resolves.toMatchObject({
      banner: {
        campaignId: created.id,
        navigationEffect: 'ANIMATED',
        ctaPath: `/campaigns/${slug}`,
        textColor: design.theme.foreground,
        display: { title: 'نوروز', icon: 'STAR', backgroundColor: design.theme.background },
      },
    });
    expect((await campaigns.publicActivity(now)).activeIds).toContain(created.id);
    await db.campaign.update({ where: { id: created.id }, data: { status: 'PAUSED' } });
    await expect(landings.placement('NAVIGATION', undefined, now)).resolves.toMatchObject({
      banner: { campaignId: secondary.id },
    });
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

    await db.product.createMany({
      data: Array.from({ length: 13 }, (_, index) => ({
        slug: `${slug}-page-${index}`,
        name: `محصول آزمون ${index}`,
        status: 'ACTIVE',
      })),
    });
    const firstPage = await campaigns.selectProducts({ q: `${slug}-page` });
    const secondPage = await campaigns.selectProducts({ q: `${slug}-page`, page: 2 });
    expect(firstPage).toMatchObject({ page: 1, hasMore: true });
    expect(firstPage.items).toHaveLength(12);
    expect(secondPage).toMatchObject({ page: 2, hasMore: false });
    expect(secondPage.items).toHaveLength(1);
    expect(firstPage.items.map(({ id }) => id)).not.toContain(secondPage.items[0].id);
  } finally {
    try {
      await db.$transaction([
        db.campaignQuota.deleteMany({ where: { campaign: { trackingId: slug } } }),
        db.campaignPromotion.deleteMany({ where: { campaign: { trackingId: slug } } }),
        db.campaignPlacement.deleteMany({
          where: { landing: { slug: { in: [slug, secondarySlug] } } },
        }),
        db.campaignLanding.deleteMany({ where: { slug: { in: [slug, secondarySlug] } } }),
        db.campaignRevision.deleteMany({
          where: { campaign: { trackingId: { in: [slug, secondarySlug] } } },
        }),
        db.media.deleteMany({ where: { storageKey: { startsWith: `catalog/${slug}-` } } }),
        db.campaign.deleteMany({ where: { trackingId: { in: [slug, secondarySlug] } } }),
        db.campaignLinkIdentity.deleteMany({ where: { id: { in: [slug, secondarySlug] } } }),
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
