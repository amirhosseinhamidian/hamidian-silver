import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import { PromotionsService } from '../src/modules/promotions/promotions.service';
import type { CreateOrderDto } from '../src/modules/orders/dto/create-order.dto';

it('serializes a limited promotion, replays one order and preserves its original price', async () => {
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
      include: { priceQuote: true },
    });
    expect(saved).toMatchObject({
      discountTotalToman: 2_000,
      grandTotalToman: 6_700,
      priceQuote: {
        campaignId: campaign.id,
        snapshot: { discountTotalToman: 2_000, rule: { kind: 'FIXED', version: 1 } },
      },
    });

    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'DRAFT' } });
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
  } finally {
    try {
      await db.$transaction([
        db.orderPriceQuote.deleteMany({ where: { order: { user: buyers } } }),
        db.orderStatusHistory.deleteMany({ where: { order: { user: buyers } } }),
        db.orderAddress.deleteMany({ where: { order: { user: buyers } } }),
        db.orderItem.deleteMany({ where: { order: { user: buyers } } }),
        db.order.deleteMany({ where: { user: buyers } }),
        db.inventoryMovement.deleteMany({ where: { inventory: { variant: { sku: trackingId } } } }),
        db.inventory.deleteMany({ where: { variant: { sku: trackingId } } }),
        db.productVariant.deleteMany({ where: { sku: trackingId } }),
        db.product.deleteMany({ where: { slug: trackingId } }),
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
