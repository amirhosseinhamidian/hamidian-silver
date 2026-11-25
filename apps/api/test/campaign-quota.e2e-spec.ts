import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { CampaignLandingsService } from '../src/modules/campaigns/campaign-landings.service';
import { CampaignOperationsCenterService } from '../src/modules/campaigns/campaign-operations-center.service';
import { CampaignQuotasService } from '../src/modules/campaigns/campaign-quotas.service';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { PublicMediaUrlService } from '../src/modules/catalog/public-media-url.service';
import type { CreateOrderDto } from '../src/modules/orders/dto/create-order.dto';
import { OrderExpirationService } from '../src/modules/orders/order-expiration.service';
import { OrderReturnsService } from '../src/modules/orders/order-returns.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import type { PaymentGateway } from '../src/modules/payments/payment-gateway.port';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PromotionsService } from '../src/modules/promotions/promotions.service';
import { createFestivalDraft, publishFestival } from './support/festival-purchase';

it('reconciles published festival prices with Checkout and protects quota across payments and returns', async () => {
  const config = new ConfigService({
    OTP_PEPPER: 'campaign-quota-test',
    MANUAL_SHIPPING_COST_TOMAN: 700,
    SHIPPING_PROVIDER: 'disabled',
  });
  const db = new PrismaService(config);
  const promotions = new PromotionsService(db);
  const quotas = new CampaignQuotasService(db, promotions);
  const media = new PublicMediaUrlService(config);
  const catalog = new CatalogService(db, media, undefined, promotions);
  const landings = new CampaignLandingsService(db, catalog, media);
  const campaigns = new CampaignsService(db, media, landings);
  const operations = new CampaignOperationsCenterService(db, catalog, landings, media);
  const orders = new OrdersService(
    db,
    undefined,
    config,
    undefined,
    undefined,
    undefined,
    promotions,
  );
  const returns = new OrderReturnsService(db);
  const expiration = new OrderExpirationService(db);
  let failureCode: string | null = 'INVALID_RESPONSE';
  const gateway: PaymentGateway = {
    providerCode: 'test',
    async initiate({ attemptId }) {
      return { authority: attemptId, paymentUrl: 'https://payments.example.test/pay' };
    },
    async verify({ authority }) {
      return failureCode
        ? { success: false, code: failureCode }
        : { success: true, referenceId: authority };
    },
  };
  const payments = new PaymentsService(db, config, gateway);
  const slug = `quota-${randomUUID()}`;
  const anotherSlug = `${slug}-other`;
  const healthProductScope = { slug: { startsWith: `${slug}-health-` } };
  const campaignFilter = { slug: { in: [slug, anotherSlug] } };
  const phoneSuffix = BigInt(`0x${slug.slice(5).replaceAll('-', '').slice(0, 12)}`).toString();
  const phones = [`+0${phoneSuffix}1`, `+0${phoneSuffix}2`];
  const orderFilter = { user: { phone: { in: phones } } };
  const receipt = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const receiptCardNumber = phoneSuffix.padStart(16, '0');
  try {
    const buyers = await Promise.all(phones.map((phone) => db.user.create({ data: { phone } })));
    const manager = buyers[0].id;
    const warehouse =
      (await db.warehouse.findFirst({
        where: { isDefault: true, isActive: true, deletedAt: null },
      })) ??
      (await db.warehouse.create({
        data: { code: slug, name: 'Campaign quota test', isDefault: true },
      }));
    const product = await db.product.create({
      data: {
        slug,
        name: 'محصول سهمیه‌دار',
        status: 'ACTIVE',
        salePriceToman: 25_000,
        variants: {
          create: [slug, anotherSlug].map((sku) => ({ sku, salePriceToman: 20_000 })),
        },
      },
      include: { variants: true },
    });
    await db.inventory.createMany({
      data: product.variants.map(({ id }) => ({
        variantId: id,
        warehouseId: warehouse.id,
        onHand: 2,
      })),
    });
    const startsAt = new Date(Date.now() - 60_000);
    const endsAt = new Date(Date.now() + 20 * 60_000);
    const festival = await createFestivalDraft(campaigns, {
      slug,
      productSlug: product.slug,
      ownerId: manager,
      startsAt,
      endsAt,
      budgetToman: 4_500,
    });
    await db.campaignLinkIdentity.create({ data: { id: anotherSlug, campaign: anotherSlug } });
    const { id: overlappingId } = await db.campaign.create({
      data: {
        slug: anotherSlug,
        trackingId: anotherSlug,
        ownerId: manager,
        name: 'کمپین آزمایشی',
        goal: 'آزمون سهمیه',
        channel: 'email',
        allProducts: false,
        productIds: [product.id],
        budgetToman: 100_000,
        startsAt,
        endsAt,
        message: 'دادهٔ آزمایش',
      },
    });
    const campaignId = festival.id;
    for (const id of [campaignId, overlappingId]) {
      await promotions.save(
        id,
        {
          kind: 'PERCENT',
          value: 1_000,
          minSubtotalToman: 0,
          maxDiscountToman: 10_000,
          maxDiscountBps: 2_000,
          priority: 10,
          bundleProductSlugs: [],
          expectedVersion: 0,
        },
        manager,
      );
    }
    const update = (limit: number, manualSold: number, expectedRevision: number, id = campaignId) =>
      quotas.save(id, { slug, limit, manualSold, expectedRevision }, manager);

    await expect(update(5, 1, 0)).rejects.toThrow('exceeds sellable stock');
    await expect(update(2, 1, 0)).resolves.toMatchObject({
      manualSold: 1,
      siteSold: 0,
      reserved: 0,
      remaining: 1,
    });
    await expect(update(1, 0, 0, overlappingId)).rejects.toThrow('same period');
    await expect(update(2, 1, 0)).rejects.toThrow('quota changed');
    await expect(db.order.count({ where: orderFilter })).resolves.toBe(0);
    await expect(db.payment.count({ where: { order: orderFilter } })).resolves.toBe(0);
    await expect(
      db.inventory.findMany({
        where: { variant: { productId: product.id } },
        select: { onHand: true, reserved: true },
      }),
    ).resolves.toEqual([
      { onHand: 2, reserved: 0 },
      { onHand: 2, reserved: 0 },
    ]);

    await expect(operations.read(campaignId, {}, false)).resolves.toMatchObject({
      orders: { registered: 0, confirmed: 0 },
      quota: { limit: 2, manualSold: 1, siteSold: 0, reserved: 0, remaining: 1 },
      finance: null,
    });
    const published = await publishFestival(campaigns, landings, festival, product.slug);
    const expectedProductCard = {
      id: product.id,
      defaultSalePriceToman: 25_000,
      campaignOffer: {
        campaignId,
        price: { regularToman: 25_000, discountToman: 2_500, finalToman: 22_500 },
      },
      campaignQuota: { sold: 1, remaining: 1 },
    };
    await expect(landings.publicLanding(slug, 1)).resolves.toMatchObject({
      isFestival: true,
      active: true,
      publicationVersion: published.revision,
      products: { items: [expectedProductCard] },
    });
    const details = await catalog.getPublicProduct(slug);
    expect(details.campaignOffer).toMatchObject(expectedProductCard.campaignOffer);
    expect(details.variants).toHaveLength(2);
    for (const variant of details.variants) {
      expect(variant.campaignOffer).toMatchObject({
        price: { regularToman: 20_000, discountToman: 2_000, finalToman: 18_000 },
      });
    }
    const baskets = product.variants.map(
      ({ id: variantId }) =>
        ({
          shippingAddress: {
            recipientName: 'کاربر آزمون',
            phone: '09121234567',
            province: 'تهران',
            city: 'تهران',
            addressLine: 'نشانی ساختگی آزمون',
            postalCode: '1234567890',
          },
          items: [{ variantId, quantity: 1 }],
        }) satisfies CreateOrderDto,
    );
    const quotes = await Promise.all(
      buyers.map(({ id }, index) => orders.quotePrice(id, baskets[index])),
    );
    for (const quote of quotes) {
      expect(quote).toMatchObject({ discountTotalToman: 2_000, payableToman: 18_700 });
    }
    const submissions = await Promise.allSettled(
      buyers.map(({ id }, index) =>
        orders.createOrder(id, {
          ...baskets[index],
          quoteToken: quotes[index].quoteToken,
        }),
      ),
    );
    expect(submissions.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const winner = submissions.findIndex(({ status }) => status === 'fulfilled');
    const loser = 1 - winner;
    expect(submissions[loser]).toMatchObject({
      status: 'rejected',
      reason: { code: 'ORDER_PRICE_QUOTE_CHANGED' },
    });
    const buyerId = buyers[winner].id;
    const pending = await db.order.findFirstOrThrow({ where: { userId: buyerId } });
    expect(pending).toMatchObject({ campaignQuotaRestricted: true, grandTotalToman: 18_700 });
    await expect(
      db.inventory.findMany({
        where: { variantId: { in: product.variants.map(({ id }) => id) } },
        select: { variantId: true, onHand: true, reserved: true },
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        { variantId: product.variants[winner].id, onHand: 2, reserved: 1 },
        { variantId: product.variants[loser].id, onHand: 2, reserved: 0 },
      ]),
    );

    const full = await catalog.getPublicProduct(slug);
    expect(full.campaignQuota).toMatchObject({ sold: 1, remaining: 0 });
    expect(full.campaignOffer).toBeNull();
    await expect(landings.publicLanding(slug, 1)).resolves.toMatchObject({
      publicationVersion: published.revision,
      products: {
        items: [{ id: product.id, campaignOffer: null, campaignQuota: { remaining: 0 } }],
      },
    });
    await expect(orders.quotePrice(buyers[loser].id, baskets[loser])).resolves.toMatchObject({
      discountTotalToman: 0,
    });
    await db.productVariant.update({
      where: { id: product.variants[winner].id },
      data: { salePriceToman: 30_000 },
    });

    const declined = await payments.initiateOrderPayment(buyerId, pending.id, {
      idempotencyKey: randomUUID(),
    });
    expect(declined.authority).toBeDefined();
    await expect(
      payments.verifyCallback(declined.attemptId, declined.authority!),
    ).rejects.toMatchObject({ code: 'PAYMENT_FAILED' });
    await expect(quotas.get(campaignId, slug)).resolves.toMatchObject({
      reserved: 1,
      remaining: 0,
    });
    failureCode = 'DECLINED';
    await expect(
      payments.verifyCallback(declined.attemptId, declined.authority!),
    ).rejects.toMatchObject({ code: 'PAYMENT_FAILED' });
    await expect(quotas.get(campaignId, slug)).resolves.toMatchObject({
      reserved: 0,
      remaining: 1,
    });

    await update(2, 2, 1);
    await expect(
      payments.initiateOrderPayment(buyerId, pending.id, { idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({
      code: 'CAMPAIGN_QUOTA_UNAVAILABLE',
    });
    await update(2, 1, 2);
    await db.cardToCardAccount.create({
      data: {
        cardNumber: receiptCardNumber,
        ibanNumber: receiptCardNumber.padStart(24, '0'),
        holderName: 'Quota test',
        bankName: 'Test',
        isActive: true,
      },
    });
    const payment = await payments.submitCardToCardReceipt(buyerId, pending.id, randomUUID(), {
      buffer: receipt,
      mimetype: 'image/png',
      originalname: 'receipt.png',
      size: receipt.length,
    });
    await expect(quotas.get(campaignId, slug)).resolves.toMatchObject({ reserved: 1, siteSold: 0 });
    await expect(operations.read(campaignId, {}, true)).resolves.toMatchObject({
      orders: { awaitingReceipt: 1, rejectedReceipt: 0 },
      quota: { reserved: 1, manualSold: 1, siteSold: 0 },
    });
    await payments.rejectCardToCardReceipt(payment.attemptId, manager, 'test rejection');
    await expect(
      payments.rejectCardToCardReceipt(payment.attemptId, manager, 'test rejection'),
    ).resolves.toMatchObject({ alreadyRejected: true });
    await expect(quotas.get(campaignId, slug)).resolves.toMatchObject({
      reserved: 0,
      remaining: 1,
    });

    await expect(
      operations.read(campaignId, { orderState: 'RECEIPT_REJECTED' }, true),
    ).resolves.toMatchObject({
      orders: { registered: 1, confirmed: 0, awaitingReceipt: 0, rejectedReceipt: 1 },
      orderItems: [{ id: pending.id, state: 'RECEIPT_REJECTED', discountApplied: true }],
      finance: { confirmedMerchandiseDiscountToman: 0 },
    });
    failureCode = null;
    const retry = await payments.initiateOrderPayment(buyerId, pending.id, {
      idempotencyKey: randomUUID(),
    });
    expect(retry.authority).toBeDefined();
    const confirmations = await Promise.all(
      [0, 1].map(() => payments.verifyCallback(retry.attemptId, retry.authority!)),
    );
    expect(confirmations.every(({ success }) => success)).toBe(true);
    await expect(quotas.get(campaignId, slug)).resolves.toMatchObject({
      reserved: 0,
      remaining: 0,
      siteSold: 1,
    });
    await expect(
      db.orderPriceQuote.findUniqueOrThrow({ where: { orderId: pending.id } }),
    ).resolves.toMatchObject({
      campaignId,
      merchandiseDiscountToman: 2_000,
      snapshot: {
        payableToman: 18_700,
        rule: { kind: 'PERCENT', version: 1 },
        items: [{ unitSalePriceToman: 20_000 }],
      },
    });
    const anotherOrder = await orders.createOrder(buyers[loser].id, baskets[loser]);
    const { trackingId } = await db.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { trackingId: true },
    });
    await db.orderAttribution.createMany({
      data: [pending.id, anotherOrder.id].map((orderId) => ({
        orderId,
        policyVersion: 1,
        windowDays: 30,
        model: 'LAST_NON_DIRECT',
        firstTouch: {},
        lastTouch: {},
        source: 'email',
        medium: 'email',
        campaignId: trackingId,
        attributedAt: new Date(),
      })),
    });
    await expect(operations.read(campaignId, {}, true)).resolves.toMatchObject({
      orders: { registered: 2, confirmed: 1, pending: 1, rejectedReceipt: 0 },
      orderItems: expect.arrayContaining([
        expect.objectContaining({ id: pending.id, discountApplied: true }),
        expect.objectContaining({ id: anotherOrder.id, discountApplied: false }),
      ]),
      quota: { reserved: 0, manualSold: 1, siteSold: 1 },
      finance: { confirmedMerchandiseDiscountToman: 2_000, confirmedShippingDiscountToman: 0 },
    });
    const newest = await operations.read(campaignId, {}, false);
    const oldest = await operations.read(campaignId, { orderSort: 'oldest' }, false);
    expect(oldest.orderItems).toEqual([...newest.orderItems].reverse());
    await expect(
      operations.read(campaignId, { orderState: 'PENDING', orderSort: 'oldest' }, false),
    ).resolves.toMatchObject({ finance: null, orderItems: [{ id: anotherOrder.id }] });
    await expect(orders.listOrders({ orderId: pending.id, limit: 1 })).resolves.toMatchObject([
      { id: pending.id },
    ]);
    await orders.cancelOrder(anotherOrder.id, {}, manager);

    const shipped = await db.order.update({
      where: { id: pending.id },
      data: { status: 'SHIPPED' },
      include: { items: true },
    });
    expect(shipped.grandTotalToman).toBe(pending.grandTotalToman);
    const returned = await returns.create(pending.id, manager, {
      reason: 'Test return',
      items: [{ orderItemId: shipped.items[0].id, quantity: 1 }],
    });
    await returns.receive(returned.id, manager, {
      items: [{ returnItemId: returned.items[0].id, disposition: 'RESTOCK' }],
    });
    await expect(quotas.get(campaignId, slug)).resolves.toMatchObject({
      reserved: 0,
      remaining: 0,
      siteSold: 1,
      sellableStock: 4,
    });

    await update(2, 0, 3);
    await db.inventory.updateMany({
      where: { variant: { productId: product.id } },
      data: { onHand: 0 },
    });
    await expect(operations.read(campaignId, {}, false)).resolves.toMatchObject({
      quotaItems: [{ productId: product.id, remaining: 1, sellableStock: 0, stockShortfall: 1 }],
      publication: 'EMPTY',
      festival: { stockShortfallProducts: 1, missingDefaultPriceProducts: 0 },
    });
    await db.inventory.updateMany({
      where: { variant: { productId: product.id } },
      data: { onHand: 2 },
    });
    const restoredStock = await catalog.getPublicProduct(slug);
    expect(restoredStock.campaignOffer).toMatchObject(expectedProductCard.campaignOffer);
    expect(
      restoredStock.variants.find(({ id }) => id === product.variants[winner].id),
    ).toMatchObject({
      campaignOffer: {
        price: { regularToman: 30_000, discountToman: 2_500, finalToman: 27_500 },
      },
    });
    await expect(orders.quotePrice(buyerId, baskets[winner])).resolves.toMatchObject({
      discountTotalToman: 2_500,
      payableToman: 28_200,
    });

    const createPending = async () => {
      const id = buyers[loser].id;
      const quote = await orders.quotePrice(id, baskets[loser]);
      expect(quote.discountTotalToman).toBe(2_000);
      return orders.createOrder(id, { ...baskets[loser], quoteToken: quote.quoteToken });
    };
    const cancelled = await createPending();
    await orders.cancelOrder(cancelled.id, {}, manager);
    await expect(quotas.get(campaignId, slug)).resolves.toMatchObject({
      reserved: 0,
      remaining: 1,
    });
    const expiring = await createPending();
    const order = await db.order.findUniqueOrThrow({ where: { id: expiring.id } });
    await expect(
      expiration.expireOrder(expiring.id, new Date(order.reservationExpiresAt.getTime() + 1)),
    ).resolves.toBe(true);
    await expect(quotas.get(campaignId, slug)).resolves.toMatchObject({
      reserved: 0,
      remaining: 1,
    });
    await expect(
      db.campaignQuotaChange.findMany({
        where: { quota: { campaignId }, actorUserId: manager },
        orderBy: { revision: 'asc' },
        select: { manualSold: true },
      }),
    ).resolves.toEqual([1, 2, 1, 0].map((manualSold) => ({ manualSold })));

    const healthIds = Array.from({ length: 26 }, () => randomUUID()).sort();
    const shortageId = healthIds.at(-1);
    await db.product.createMany({
      data: healthIds.map((id, index) => ({
        id,
        slug: `${slug}-health-${index}`,
        name: 'کالای آزمون سلامت',
        status: 'ACTIVE',
        salePriceToman: id === shortageId ? null : 25_000,
      })),
    });
    await db.campaignQuota.createMany({
      data: healthIds.map((productId) => ({
        campaignId,
        productId,
        limit: 1,
        manualSold: productId === shortageId ? 0 : 1,
      })),
    });
    const firstPage = await operations.read(campaignId, {}, false);
    expect(firstPage).toMatchObject({
      hasMoreQuotas: true,
      festival: { stockShortfallProducts: 1, missingDefaultPriceProducts: 1 },
    });
    expect(firstPage.quotaItems.every(({ stockShortfall }) => stockShortfall === 0)).toBe(true);
    const secondPage = await operations.read(campaignId, { quotaPage: 2 }, false);
    expect(secondPage.quotaItems.find(({ productId }) => productId === shortageId)).toMatchObject({
      stockShortfall: 1,
      defaultPriceToman: null,
      productStatus: 'ACTIVE',
    });
  } finally {
    try {
      const identities = await db.campaign.findMany({
        where: campaignFilter,
        select: { trackingId: true },
      });
      await db.$transaction([
        db.inventoryMovement.deleteMany({
          where: { inventory: { variant: { product: { slug } } } },
        }),
        db.orderReturnItem.deleteMany({ where: { orderReturn: { order: orderFilter } } }),
        db.orderReturn.deleteMany({ where: { order: orderFilter } }),
        db.paymentAttempt.deleteMany({ where: { payment: { order: orderFilter } } }),
        db.payment.deleteMany({ where: { order: orderFilter } }),
        db.campaignQuotaAllocation.deleteMany({ where: { order: orderFilter } }),
        db.campaignQuotaChange.deleteMany({ where: { quota: { campaign: campaignFilter } } }),
        db.campaignQuota.deleteMany({ where: { campaign: campaignFilter } }),
        db.orderPriceQuote.deleteMany({ where: { order: orderFilter } }),
        db.orderStatusHistory.deleteMany({ where: { order: orderFilter } }),
        db.orderAddress.deleteMany({ where: { order: orderFilter } }),
        db.orderItem.deleteMany({ where: { order: orderFilter } }),
        db.purchaseRewardJob.deleteMany({ where: { order: orderFilter } }),
        db.order.deleteMany({ where: orderFilter }),
        db.inventory.deleteMany({ where: { variant: { product: { slug } } } }),
        db.productVariant.deleteMany({ where: { product: { slug } } }),
        db.product.deleteMany({ where: { slug } }),
        db.product.deleteMany({ where: healthProductScope }),
        db.campaignPromotion.deleteMany({ where: { campaign: campaignFilter } }),
        db.campaignLanding.deleteMany({ where: { campaign: campaignFilter } }),
        db.campaignRevision.deleteMany({ where: { campaign: campaignFilter } }),
        db.campaign.deleteMany({ where: campaignFilter }),
        db.campaignLinkIdentity.deleteMany({
          where: { id: { in: [...identities.map(({ trackingId }) => trackingId), anotherSlug] } },
        }),
        db.cardToCardAccount.deleteMany({ where: { cardNumber: receiptCardNumber } }),
        db.warehouse.deleteMany({ where: { code: slug } }),
        db.user.deleteMany({ where: { phone: { in: phones } } }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 30_000);
