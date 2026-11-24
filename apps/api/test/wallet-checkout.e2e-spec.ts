import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { CampaignQuotasService } from '../src/modules/campaigns/campaign-quotas.service';
import { OrderFinanceService } from '../src/modules/finance/order-finance.service';
import { PaymentRefundsService } from '../src/modules/finance/payment-refunds.service';
import type { CreateOrderDto } from '../src/modules/orders/dto/create-order.dto';
import { OrderExpirationService } from '../src/modules/orders/order-expiration.service';
import { OrderReturnsService } from '../src/modules/orders/order-returns.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import type { PaymentGateway } from '../src/modules/payments/payment-gateway.port';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PromotionsService } from '../src/modules/promotions/promotions.service';
import { RewardPoliciesService } from '../src/modules/reward-policies/reward-policies.service';
import { WalletCheckoutService } from '../src/modules/wallet/wallet-checkout.service';
import { WalletLedgerService } from '../src/modules/wallet/wallet-ledger.service';

it('reserves once, holds uncertain attempts and restores the exact credit on returns and full refunds', async () => {
  const config = new ConfigService({
    OTP_PEPPER: 'wallet-checkout-test',
    SHIPPING_PROVIDER: 'disabled',
    MANUAL_SHIPPING_COST_TOMAN: 0,
  });
  const db = new PrismaService(config);
  const ledger = new WalletLedgerService(db);
  const wallet = new WalletCheckoutService(new RewardPoliciesService(db), ledger);
  const promotions = new PromotionsService(db);
  const quotas = new CampaignQuotasService(db, promotions);
  const orders = new OrdersService(
    db,
    undefined,
    config,
    undefined,
    undefined,
    undefined,
    promotions,
    wallet,
  );
  const finance = new OrderFinanceService(db);
  let failureCode: string | null = 'INVALID_RESPONSE';
  const gateway: PaymentGateway = {
    providerCode: 'zarinpal',
    async initiate({ attemptId }) {
      return { authority: attemptId, paymentUrl: 'https://payments.example.test/pay' };
    },
    async verify({ authority }) {
      return failureCode
        ? {
            success: false,
            code: failureCode,
            ...(failureCode === '-51' ? { definitiveFailure: true as const } : {}),
          }
        : { success: true, referenceId: authority };
    },
  };
  const payments = new PaymentsService(
    db,
    config,
    gateway,
    undefined,
    finance,
    undefined,
    undefined,
    wallet,
  );
  const returns = new OrderReturnsService(db, wallet);
  const refunds = new PaymentRefundsService(db, wallet);
  const expiration = new OrderExpirationService(db, wallet);
  const key = randomUUID();
  const phoneSuffix = BigInt(`0x${key.replaceAll('-', '').slice(0, 12)}`).toString();
  const now = new Date();
  const expiry = new Date(+now + 24 * 60 * 60 * 1000);

  try {
    const user = await db.user.create({ data: { phone: `+0${phoneSuffix}` } });
    const warehouse =
      (await db.warehouse.findFirst({
        where: { isDefault: true, isActive: true, deletedAt: null },
      })) ??
      (await db.warehouse.create({
        data: { name: 'Wallet checkout test', code: key, isDefault: true },
      }));
    const product = await db.product.create({
      data: {
        name: 'کالای آزمایشی',
        slug: `wallet-${key}`,
        status: 'ACTIVE',
        salePriceToman: 20_000,
        variants: { create: { sku: key } },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0].id;
    await db.inventory.create({ data: { warehouseId: warehouse.id, variantId, onHand: 8 } });
    const campaignKey = `wallet-${key}`;
    await db.campaignLinkIdentity.create({ data: { id: campaignKey, campaign: campaignKey } });
    const campaign = await db.campaign.create({
      data: {
        trackingId: campaignKey,
        slug: campaignKey,
        ownerId: user.id,
        name: 'تخفیف آزمایشی',
        goal: 'تست کیف پول',
        channel: 'email',
        message: 'آزمون سهمیه',
        allProducts: false,
        productIds: [product.id],
        budgetToman: 100_000,
        startsAt: new Date(+now - 60_000),
        endsAt: expiry,
      },
    });
    await promotions.save(
      campaign.id,
      {
        kind: 'PERCENT',
        value: 500,
        minSubtotalToman: 0,
        maxDiscountToman: 10_000,
        maxDiscountBps: 2_000,
        priority: 10,
        bundleProductSlugs: [],
        expectedVersion: 0,
      },
      user.id,
    );
    await quotas.save(
      campaign.id,
      { slug: product.slug, limit: 6, manualSold: 0, expectedRevision: 0 },
      user.id,
    );
    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'ACTIVE' } });
    const eligibility = {
      allowCoupon: false,
      allowedCategoryIds: [],
      excludedCategoryIds: [],
      excludedProductIds: [],
    };
    const version = await db.rewardPolicyVersion.create({
      data: {
        requestId: randomUUID(),
        createdById: user.id,
        publishedById: user.id,
        effectiveAt: now,
        publishedAt: now,
        definition: {
          enabled: true,
          expiryDays: 30,
          grantRules: [
            {
              code: 'purchase',
              enabled: true,
              priority: 1,
              minimumToman: 1,
              capToman: 100_000,
              purchaseRank: 'ANY',
              method: 'PERCENT',
              value: 1_000,
            },
          ],
          grantEligibility: eligibility,
          redemptionEligibility: eligibility,
          redemptionBands: [
            {
              code: 'wallet',
              enabled: true,
              priority: 1,
              minimumToman: 1,
              rateBps: 10_000,
              capToman: 100_000,
            },
          ],
          budget: {
            rewardPerOrderToman: 100_000,
            rewardPerCustomerPeriodToman: 100_000,
            rewardPerPeriodToman: 100_000,
            incentivesPerOrderToman: 100_000,
            incentivesPerCustomerPeriodToman: 100_000,
            incentivesPerPeriodToman: 100_000,
          },
        },
      },
    });
    const origin = await db.order.create({
      data: {
        orderNumber: `wallet-${key.slice(0, 18)}`,
        userId: user.id,
        warehouseId: warehouse.id,
        status: 'PAID',
        createdAt: now,
        paidAt: now,
        merchandiseTotalToman: 100_000,
        grandTotalToman: 100_000,
        reservationExpiresAt: expiry,
        payment: { create: { status: 'PAID', paidAt: now, amountToman: 100_000 } },
      },
    });
    const grant = await ledger.grant({
      userId: user.id,
      orderId: origin.id,
      source: 'PURCHASE',
      sourceKey: origin.id,
      policyVersion: version.version,
      expiresAt: expiry,
      amountToman: 50_000,
      idempotencyKey: randomUUID(),
    });
    await ledger.activate({
      userId: user.id,
      lotId: grant.movements[0].lotId,
      idempotencyKey: randomUUID(),
    });

    const body: CreateOrderDto = {
      useWalletCredit: true,
      items: [{ variantId, quantity: 2 }],
      shippingAddress: {
        recipientName: 'کاربر آزمایش',
        phone: '09121234567',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'نشانی ساختگی آزمون',
        postalCode: '1234567890',
      },
    };
    const freshQuote = () => orders.quotePrice(user.id, body);
    const create = (quoteToken: string) => orders.createOrder(user.id, { ...body, quoteToken });
    const [firstQuote, secondQuote] = await Promise.all([freshQuote(), freshQuote()]);
    expect(firstQuote).toMatchObject({
      payableToman: 10_000,
      discountTotalToman: 2_000,
      walletAppliedToman: 28_000,
    });
    await expect(ledger.balance(user.id)).resolves.toMatchObject({
      availableToman: 50_000,
      reservedToman: 0,
    });
    const submissions = await Promise.allSettled([
      create(firstQuote.quoteToken),
      create(secondQuote.quoteToken),
    ]);
    expect(submissions.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
    const accepted = submissions[0].status === 'fulfilled' ? submissions[0] : submissions[1];
    if (accepted.status !== 'fulfilled') throw new Error('Expected a successful order');
    const order = accepted.value;
    expect(order).toMatchObject({ grandTotalToman: 10_000, walletAppliedToman: 28_000 });
    await expect(
      create(
        submissions[0].status === 'fulfilled' ? firstQuote.quoteToken : secondQuote.quoteToken,
      ),
    ).resolves.toMatchObject({ id: order.id });
    await expect(db.inventory.findFirst({ where: { variantId } })).resolves.toMatchObject({
      reserved: 2,
    });
    await expect(quotas.get(campaign.id, product.slug)).resolves.toMatchObject({
      reserved: 2,
      siteSold: 0,
    });

    const initiate = (id: string) =>
      payments.initiateOrderPayment(user.id, id, { idempotencyKey: randomUUID() });
    const attempt = await initiate(order.id);
    await expect(
      payments.verifyCallback(attempt.attemptId, attempt.authority!),
    ).rejects.toMatchObject({ code: 'PAYMENT_FAILED' });
    await expect(expiration.expireOrder(order.id, new Date(+now + 60 * 60 * 1000))).resolves.toBe(
      false,
    );
    await expect(orders.cancelMyOrder(user.id, order.id, {})).rejects.toMatchObject({
      code: 'ORDER_CANNOT_CANCEL',
    });
    await expect(ledger.balance(user.id)).resolves.toMatchObject({
      availableToman: 22_000,
      reservedToman: 28_000,
    });
    failureCode = '-51';
    await expect(
      payments.verifyCallback(attempt.attemptId, attempt.authority!),
    ).rejects.toMatchObject({ code: 'PAYMENT_FAILED' });
    await expect(ledger.balance(user.id)).resolves.toMatchObject({
      availableToman: 50_000,
      reservedToman: 0,
    });

    const receipt = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const cardNumber = phoneSuffix.padStart(16, '0');
    await db.cardToCardAccount.create({
      data: {
        cardNumber,
        ibanNumber: cardNumber.padStart(24, '0'),
        holderName: 'Wallet checkout test',
        bankName: 'Test',
        isActive: true,
      },
    });
    const uploadReceipt = () =>
      payments.submitCardToCardReceipt(user.id, order.id, randomUUID(), {
        buffer: receipt,
        mimetype: 'image/png',
        originalname: 'receipt.png',
        size: receipt.length,
      });
    const rejected = await uploadReceipt();
    await payments.rejectCardToCardReceipt(
      rejected.attemptId,
      user.id,
      'Receipt rejected for test',
    );
    await expect(
      payments.rejectCardToCardReceipt(rejected.attemptId, user.id, 'Receipt rejected for test'),
    ).resolves.toMatchObject({ alreadyRejected: true });
    await expect(ledger.balance(user.id)).resolves.toMatchObject({
      availableToman: 50_000,
      reservedToman: 0,
    });
    const approved = await uploadReceipt();
    await payments.confirmCardToCardReceipt(approved.attemptId, user.id);
    await expect(
      payments.confirmCardToCardReceipt(approved.attemptId, user.id),
    ).resolves.toMatchObject({ success: true });
    await expect(
      db.orderFinanceSnapshot.findUnique({ where: { orderId: order.id } }),
    ).resolves.toMatchObject({
      netSalesToman: 38_000,
      walletAppliedToman: 28_000,
      customerTotalToman: 10_000,
    });
    await ledger.grant({
      userId: user.id,
      orderId: order.id,
      source: 'PURCHASE',
      sourceKey: order.id,
      policyVersion: version.version,
      expiresAt: expiry,
      amountToman: 1_000,
      idempotencyKey: randomUUID(),
    });

    const shipped = await db.order.update({
      where: { id: order.id },
      data: { status: 'SHIPPED' },
      include: { items: true },
    });
    for (const balance of [36_000, 50_000]) {
      const returned = await returns.create(order.id, user.id, {
        reason: 'Wallet return test',
        items: [{ orderItemId: shipped.items[0].id, quantity: 1 }],
      });
      const received = {
        items: [{ returnItemId: returned.items[0].id, disposition: 'RESTOCK' as const }],
      };
      await returns.receive(returned.id, user.id, received);
      await returns.receive(returned.id, user.id, received);
      await expect(ledger.balance(user.id)).resolves.toMatchObject({
        availableToman: balance,
        reservedToman: 0,
        pendingToman: balance === 36_000 ? 500 : 0,
      });
    }
    await expect(quotas.get(campaign.id, product.slug)).resolves.toMatchObject({
      reserved: 0,
      siteSold: 2,
    });

    const anotherOrder = await create((await freshQuote()).quoteToken);
    const online = await initiate(anotherOrder.id);
    failureCode = null;
    await payments.verifyCallback(online.attemptId, online.authority!);
    await expect(
      payments.verifyCallback(online.attemptId, online.authority!),
    ).resolves.toMatchObject({ alreadyVerified: true });
    const refund = await refunds.create(user.id, {
      orderId: anotherOrder.id,
      amountToman: 10_000,
      idempotencyKey: randomUUID(),
    });
    const confirmation = { externalReference: randomUUID() };
    await refunds.confirm(refund.id, user.id, confirmation);
    await refunds.confirm(refund.id, user.id, confirmation);
    await expect(ledger.balance(user.id)).resolves.toMatchObject({
      availableToman: 50_000,
      reservedToman: 0,
    });
  } finally {
    await db.$disconnect();
  }
}, 30_000);
