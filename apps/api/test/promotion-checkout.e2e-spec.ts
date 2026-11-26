import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import { PromotionsService } from '../src/modules/promotions/promotions.service';
import type { CreateOrderDto } from '../src/modules/orders/dto/create-order.dto';

it('serializes a limited promotion and reconciles current campaign prices with Checkout snapshots', async () => {
  const config = new ConfigService({
    OTP_PEPPER: 'promotion-quote-test',
    MANUAL_SHIPPING_COST_TOMAN: 700,
    SHIPPING_PROVIDER: 'disabled',
  });
  const db = new PrismaService(config);
  const promotions = new PromotionsService(db);
  const orders = new OrdersService(
    db,
    undefined,
    config,
    undefined,
    undefined,
    undefined,
    promotions,
  );
  const suffix = randomUUID();
  const trackingId = `offer-${suffix}`;
  const companionSlug = `${trackingId}-companion`;
  const bundleSlug = `${trackingId}-bundle`;
  const fixtures = { slug: { in: [trackingId, companionSlug, bundleSlug] } };
  const phones = ['1', '2'].map(
    (tail) => `+0${BigInt(`0x${suffix.replaceAll('-', '').slice(0, 12)}`)}${tail}`,
  );
  const buyers = { phone: { in: phones } };
  const warehouseCode = trackingId;
  try {
    const users = await Promise.all(phones.map((phone) => db.user.create({ data: { phone } })));
    const [buyer, other] = users;
    const warehouse =
      (await db.warehouse.findFirst({
        where: { isDefault: true, isActive: true, deletedAt: null },
        select: { id: true },
      })) ??
      (await db.warehouse.create({
        data: { code: warehouseCode, name: 'Promotion test', isDefault: true },
      }));
    const product = await db.product.create({
      data: {
        slug: trackingId,
        name: 'انگشتر آزمایشی',
        status: 'ACTIVE',
        salePriceToman: 8_000,
        variants: { create: { sku: trackingId } },
      },
      include: { variants: true },
    });
    const variant = product.variants[0];
    const inventory = await db.inventory.create({
      data: { warehouseId: warehouse.id, variantId: variant.id, onHand: 5 },
    });
    await db.campaignLinkIdentity.create({ data: { id: trackingId, campaign: trackingId } });
    const campaign = await db.campaign.create({
      data: {
        slug: trackingId,
        name: 'تخفیف آزمایشی',
        goal: 'تست قیمت',
        channel: 'email',
        ownerId: buyer.id,
        trackingId,
        budgetToman: 2_500,
        plannedChannelCostToman: 500,
        audience: 'FIRST_PURCHASE',
        allProducts: false,
        productIds: [product.id],
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 600_000),
        message: 'دادهٔ آزمون',
      },
    });
    const couponCode = `T-${suffix.slice(0, 12)}`;
    await promotions.save(
      campaign.id,
      {
        kind: 'FIXED',
        value: 2_000,
        minSubtotalToman: 8_000,
        maxDiscountToman: 2_000,
        maxDiscountBps: 2_500,
        priority: 10,
        bundleProductSlugs: [],
        couponCode,
        maxUses: 1,
        expectedVersion: 0,
      },
      buyer.id,
    );
    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'ACTIVE' } });
    const basket = {
      shippingAddress: {
        recipientName: 'کاربر آزمون',
        phone: '09121234567',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'نشانی ساختگی آزمون',
        postalCode: '1234567890',
      },
      items: [{ variantId: variant.id, quantity: 1 }],
    } satisfies CreateOrderDto;
    const couponOrder = { ...basket, couponCode };
    await expect(orders.estimatePromotions(basket.items)).resolves.toMatchObject({
      discountTotalToman: 0,
      payableToman: 8_000,
    });
    const quotes = await Promise.all(users.map(({ id }) => orders.quotePrice(id, couponOrder)));
    for (const quote of quotes)
      expect(quote).toMatchObject({
        discountTotalToman: 2_000,
        shippingTotalToman: 700,
        payableToman: 6_700,
      });
    const results = await Promise.allSettled(
      users.map(({ id }, index) =>
        orders.createOrder(id, { ...couponOrder, quoteToken: quotes[index].quoteToken }),
      ),
    );
    const winner = results.findIndex((result) => result.status === 'fulfilled');
    expect(winner).toBeGreaterThanOrEqual(0);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results[1 - winner]).toMatchObject({
      status: 'rejected',
      reason: { code: 'ORDER_PRICE_QUOTE_CHANGED' },
    });
    const saved = await db.order.findFirstOrThrow({
      where: { userId: users[winner].id },
      include: { priceQuote: true, items: true },
    });
    expect(saved).toMatchObject({
      discountTotalToman: 2_000,
      grandTotalToman: 6_700,
      items: [{ campaignIdSnapshot: campaign.id, campaignNameSnapshot: campaign.name }],
      priceQuote: {
        campaignId: campaign.id,
        snapshot: { discountTotalToman: 2_000, rule: { kind: 'FIXED', version: 1 } },
      },
    });

    await expect(orders.getMyOrder(users[winner].id, saved.id)).resolves.toMatchObject({
      items: [{ campaignIdSnapshot: campaign.id, campaignNameSnapshot: campaign.name }],
    });
    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: 'DRAFT', name: 'نام تازهٔ کمپین' },
    });
    await expect(orders.getMyOrder(users[winner].id, saved.id)).resolves.toMatchObject({
      items: [{ campaignNameSnapshot: campaign.name }],
    });
    await promotions.save(
      campaign.id,
      {
        kind: 'FIXED',
        value: 500,
        minSubtotalToman: 8_000,
        maxDiscountToman: 500,
        maxDiscountBps: 2_500,
        priority: 10,
        bundleProductSlugs: [],
        couponCode,
        maxUses: 1,
        expectedVersion: 1,
      },
      buyer.id,
    );
    await db.product.update({ where: { id: product.id }, data: { salePriceToman: 9_000 } });
    await expect(
      orders.createOrder(users[winner].id, {
        ...couponOrder,
        quoteToken: quotes[winner].quoteToken,
      }),
    ).resolves.toMatchObject({
      id: saved.id,
      grandTotalToman: 6_700,
    });
    await expect(
      db.orderPriceQuote.findUniqueOrThrow({ where: { orderId: saved.id } }),
    ).resolves.toMatchObject({
      merchandiseDiscountToman: 2_000,
      snapshot: { rule: { value: 2_000, version: 1 } },
    });

    const stale = await orders.quotePrice(other.id, basket);
    await db.product.update({ where: { id: product.id }, data: { salePriceToman: 10_000 } });
    await expect(
      orders.createOrder(other.id, { ...basket, quoteToken: stale.quoteToken }),
    ).rejects.toThrow('quote changed');
    const fresh = await orders.quotePrice(other.id, basket);
    await db.inventory.update({ where: { id: inventory.id }, data: { onHand: 1 } });
    await expect(
      orders.createOrder(other.id, { ...basket, quoteToken: fresh.quoteToken }),
    ).rejects.toThrow('Inventory is not available');
    await expect(db.order.count({ where: { user: buyers } })).resolves.toBe(1);
    await expect(
      db.inventory.findUniqueOrThrow({ where: { id: inventory.id } }),
    ).resolves.toMatchObject({ reserved: 1 });

    const catalog = new CatalogService(
      db,
      new PublicMediaUrlService(config),
      undefined,
      promotions,
    );
    await db.campaign.update({
      where: { id: campaign.id },
      data: { budgetToman: 100_000, audience: 'ALL_CUSTOMERS' },
    });
    await promotions.save(
      campaign.id,
      {
        kind: 'PERCENT',
        value: 1_000,
        minSubtotalToman: 0,
        maxDiscountToman: 10_000,
        maxDiscountBps: 5_000,
        priority: 100,
        bundleProductSlugs: [],
        expectedVersion: 2,
      },
      buyer.id,
    );
    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'ACTIVE' } });
    await db.inventory.update({ where: { id: inventory.id }, data: { onHand: 5 } });
    const single = await catalog.getPublicProduct(product.slug);
    expect(single.campaignOffer?.price).toMatchObject({ regularToman: 10_000, finalToman: 9_000 });
    expect(single.variants[0].campaignOffer?.price).toEqual(single.campaignOffer?.price);

    const second = await db.productVariant.create({
      data: { productId: product.id, sku: `${trackingId}-second`, salePriceToman: 7_000 },
    });
    await db.inventory.create({
      data: { warehouseId: warehouse.id, variantId: second.id, onHand: 4 },
    });
    const listing = await catalog.listPublicProducts({ q: product.slug });
    expect(listing.items.find(({ id }) => id === product.id)).toMatchObject({
      defaultSalePriceToman: 10_000,
      campaignOffer: { price: { regularToman: 10_000, finalToman: 9_000 } },
    });
    const suggestions = await catalog.listPublicProductSuggestions(product.slug);
    expect(suggestions.items.find(({ id }) => id === product.id)).toMatchObject({
      campaignOffer: { campaignId: campaign.id, price: { finalToman: 9_000 } },
    });
    const variantPrice = (current: Awaited<ReturnType<CatalogService['getPublicProduct']>>) =>
      current.variants.find(({ id }) => id === second.id)?.campaignOffer?.price;
    expect(variantPrice(await catalog.getPublicProduct(product.slug))).toMatchObject({
      regularToman: 7_000,
      finalToman: 6_300,
    });
    const secondBasket = { ...basket, items: [{ variantId: second.id, quantity: 1 }] };
    const beforeChange = await orders.quotePrice(other.id, secondBasket);
    expect(beforeChange).toMatchObject({ discountTotalToman: 700, payableToman: 7_000 });

    await db.product.update({ where: { id: product.id }, data: { salePriceToman: 12_000 } });
    await db.productVariant.update({ where: { id: second.id }, data: { salePriceToman: 8_000 } });
    const changed = await catalog.getPublicProduct(product.slug);
    expect(changed.campaignOffer?.price).toMatchObject({
      regularToman: 12_000,
      finalToman: 10_800,
    });
    expect(variantPrice(changed)).toMatchObject({ regularToman: 8_000, finalToman: 7_200 });
    const preview = await promotions.productPricePreview(campaign.id, product.slug);
    expect(preview.prices).toHaveLength(3);
    expect(preview.prices[0].offer?.price).toEqual(changed.campaignOffer?.price);
    expect(preview.prices.find(({ variantId }) => variantId === second.id)?.offer?.price).toEqual(
      variantPrice(changed),
    );

    await expect(
      orders.createOrder(other.id, { ...secondBasket, quoteToken: beforeChange.quoteToken }),
    ).rejects.toThrow('quote changed');
    const newQuote = await orders.quotePrice(other.id, secondBasket);
    const newOrder = await orders.createOrder(other.id, {
      ...secondBasket,
      quoteToken: newQuote.quoteToken,
    });
    expect(newOrder.grandTotalToman).toBe(7_900);
    await db.productVariant.update({ where: { id: second.id }, data: { salePriceToman: 9_000 } });
    await expect(
      db.orderPriceQuote.findUniqueOrThrow({ where: { orderId: newOrder.id } }),
    ).resolves.toMatchObject({
      merchandiseDiscountToman: 800,
      snapshot: {
        payableToman: 7_900,
        rule: { version: 3 },
        items: [{ unitSalePriceToman: 8_000 }],
      },
    });

    const companion = await db.product.create({
      data: {
        slug: companionSlug,
        name: 'Companion product',
        status: 'ACTIVE',
        salePriceToman: 4_000,
        variants: { create: { sku: companionSlug } },
      },
      include: { variants: true },
    });
    await db.inventory.create({
      data: { warehouseId: warehouse.id, variantId: companion.variants[0].id, onHand: 2 },
    });
    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: 'DRAFT', productIds: [product.id, companion.id] },
    });
    await promotions.save(
      campaign.id,
      {
        kind: 'BUNDLE',
        value: 1_000,
        minSubtotalToman: 0,
        maxDiscountToman: 5_000,
        maxDiscountBps: 5_000,
        priority: 10,
        bundleProductSlugs: [product.slug, companion.slug],
        expectedVersion: 3,
      },
      buyer.id,
    );
    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'ACTIVE' } });
    const combination = {
      ...secondBasket,
      items: [...secondBasket.items, { variantId: companion.variants[0].id, quantity: 1 }],
    };
    const combinationQuote = await orders.quotePrice(other.id, combination);
    expect(combinationQuote).toMatchObject({ discountTotalToman: 1_000, payableToman: 12_700 });
    await expect(
      orders.createOrder(other.id, { ...secondBasket, quoteToken: combinationQuote.quoteToken }),
    ).rejects.toThrow('quote changed');
    await expect(orders.quotePrice(other.id, secondBasket)).resolves.toMatchObject({
      discountTotalToman: 0,
      payableToman: 9_700,
    });

    const bundle = await db.product.create({
      data: {
        slug: bundleSlug,
        name: 'Fixed composite product',
        status: 'ACTIVE',
        purchaseMode: 'COMPOSITE',
        salePriceToman: 10_000,
        variants: { create: [1, 2].map((part) => ({ sku: `${bundleSlug}-part-${part}` })) },
      },
      include: { variants: true },
    });
    const bundleStock = await Promise.all(
      bundle.variants.map(({ id }) =>
        db.inventory.create({
          data: { warehouseId: warehouse.id, variantId: id, onHand: 2 },
        }),
      ),
    );
    const packageVariant = await db.productVariant.create({
      data: {
        sku: bundleSlug,
        productId: bundle.id,
        inventoryMode: 'COMPONENTS',
        bundleComponents: {
          createMany: {
            data: bundle.variants.map(({ id }) => ({ componentVariantId: id, quantity: 1 })),
          },
        },
      },
    });
    const fixedBundle = { ...basket, items: [{ variantId: packageVariant.id, quantity: 1 }] };
    const fixedQuote = await orders.quotePrice(other.id, fixedBundle);
    expect(fixedQuote).toMatchObject({ discountTotalToman: 0, payableToman: 10_700 });
    const orderCount = await db.order.count({ where: { user: buyers } });
    await db.inventory.update({ where: { id: bundleStock[1].id }, data: { onHand: 0 } });
    await expect(
      orders.createOrder(other.id, { ...fixedBundle, quoteToken: fixedQuote.quoteToken }),
    ).rejects.toMatchObject({ code: 'INVENTORY_NOT_AVAILABLE' });
    await expect(db.order.count({ where: { user: buyers } })).resolves.toBe(orderCount);

    await db.inventory.update({ where: { id: bundleStock[1].id }, data: { onHand: 2 } });
    const confirmedQuote = await orders.quotePrice(other.id, fixedBundle);
    const bundleOrder = await orders.createOrder(other.id, {
      ...fixedBundle,
      quoteToken: confirmedQuote.quoteToken,
    });
    expect(bundleOrder.grandTotalToman).toBe(10_700);
    const reservedItems = await db.inventoryMovement.findMany({
      where: { referenceId: bundleOrder.id, type: 'RESERVATION' },
      select: { reservedDelta: true, inventory: { select: { variantId: true } } },
    });
    expect(reservedItems).toHaveLength(2);
    expect(reservedItems).toEqual(
      expect.arrayContaining(
        bundle.variants.map(({ id }) => ({
          reservedDelta: 1,
          inventory: { variantId: id },
        })),
      ),
    );
  } finally {
    try {
      await db.$transaction([
        db.orderPriceQuote.deleteMany({ where: { order: { user: buyers } } }),
        db.orderStatusHistory.deleteMany({ where: { order: { user: buyers } } }),
        db.orderAddress.deleteMany({ where: { order: { user: buyers } } }),
        db.orderItem.deleteMany({ where: { order: { user: buyers } } }),
        db.order.deleteMany({ where: { user: buyers } }),
        db.inventoryMovement.deleteMany({
          where: { inventory: { variant: { product: fixtures } } },
        }),
        db.inventory.deleteMany({ where: { variant: { product: fixtures } } }),
        db.productVariantComponent.deleteMany({ where: { bundleVariant: { product: fixtures } } }),
        db.productVariant.deleteMany({ where: { product: fixtures } }),
        db.product.deleteMany({ where: fixtures }),
        db.warehouse.deleteMany({ where: { code: warehouseCode } }),
        db.campaignPromotion.deleteMany({ where: { campaign: { trackingId } } }),
        db.campaignRevision.deleteMany({ where: { campaign: { trackingId } } }),
        db.campaign.deleteMany({ where: { trackingId } }),
        db.campaignLinkIdentity.deleteMany({ where: { id: trackingId } }),
        db.user.deleteMany({ where: buyers }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 30_000);
