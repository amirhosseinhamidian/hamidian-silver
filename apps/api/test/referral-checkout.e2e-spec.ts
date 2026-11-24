import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { CreateOrderDto } from '../src/modules/orders/dto/create-order.dto';
import { OrdersService } from '../src/modules/orders/orders.service';
import type { PaymentGateway } from '../src/modules/payments/payment-gateway.port';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PromotionsService } from '../src/modules/promotions/promotions.service';
import type { ReferralRewardRuleDto } from '../src/modules/referrals/dto/referral-reward-policy.dto';
import { ReferralRewardPoliciesService } from '../src/modules/referrals/referral-reward-policies.service';
import { ReferralsService } from '../src/modules/referrals/referrals.service';
import { createIsolatedTestDatabase } from './support/isolated-test-database';
import { seedReferralPurchase } from './support/referral-purchase';

it('reserves a versioned first-checkout discount once and confirms it at the agreed amount', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const config = new ConfigService({
    REFERRALS_ENABLED: true,
    OTP_PEPPER: 'referral-checkout-test',
    SHIPPING_PROVIDER: 'disabled',
    MANUAL_SHIPPING_COST_TOMAN: 0,
  });
  const policies = new ReferralRewardPoliciesService(db);
  const referrals = new ReferralsService(db, config);
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
  let declinePayment = true;
  const gateway: PaymentGateway = {
    providerCode: 'zarinpal',
    async initiate({ attemptId }) {
      return { authority: attemptId, paymentUrl: 'https://payments.example.test/pay' };
    },
    async verify({ authority }) {
      return declinePayment
        ? { success: false, code: '-51', definitiveFailure: true }
        : { success: true, referenceId: authority };
    },
  };
  const payments = new PaymentsService(db, config, gateway);

  try {
    const [referrer, buyer, expired] = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        db.user.create({
          data: { phone: `+98912011020${index}`, phoneVerifiedAt: new Date() },
        }),
      ),
    );
    await seedReferralPurchase(db, referrer.id, new Date(Date.now() - 2 * 86_400_000));
    const warehouse =
      (await db.warehouse.findFirst({
        where: { isDefault: true, isActive: true, deletedAt: null },
      })) ??
      (await db.warehouse.create({
        data: { code: 'referral-checkout', name: 'Referral checkout', isDefault: true },
      }));
    const variant = await db.productVariant.create({
      data: {
        sku: 'referral-checkout',
        product: {
          create: {
            slug: 'referral-checkout',
            name: 'Referral checkout',
            status: 'ACTIVE',
            salePriceToman: 25_000,
          },
        },
      },
    });
    await db.inventory.create({
      data: { warehouseId: warehouse.id, variantId: variant.id, onHand: 5 },
    });
    const buyerRule: ReferralRewardRuleDto = {
      code: 'buyer-first',
      recipient: 'REFERRED',
      enabled: true,
      priority: 10,
      purchaseRank: 'FIRST',
      method: 'FIXED',
      value: 5_000,
      minimumToman: 15_000,
      maximumExclusiveToman: null,
      capToman: 5_000,
      expiryDays: 1,
      campaignIds: [],
      allowedCategoryIds: [],
      allowCampaign: false,
      allowCoupon: false,
      allowPurchaseReward: false,
      maxUsesPerRecipient: 1,
      periodBudgetToman: 20_000,
    };
    const publish = async (rule: ReferralRewardRuleDto) => {
      const draft = await policies.createDraft(
        {
          requestId: randomUUID(),
          definition: {
            enabled: true,
            periodBudgetToman: 20_000,
            rules: [
              {
                ...buyerRule,
                recipient: 'REFERRER',
                code: 'inviter',
                value: 2_500,
                expiryDays: 30,
              },
              rule,
            ],
          },
        },
        referrer.id,
      );
      return policies.publish(draft.version, referrer.id);
    };
    const original = await publish(buyerRule);
    const { code } = await referrals.issueCode(referrer.id);
    const claim = await referrals.claim(buyer.id, code);
    const expiredClaim = await referrals.claim(expired.id, code);
    await db.referralAttribution.update({
      where: { id: expiredClaim.id },
      data: { claimedAt: new Date(Date.now() - 86_400_000) },
    });
    await expect(referrals.checkout(expired.id)).resolves.toEqual({ available: false });
    await publish({ ...buyerRule, value: 3_000, expiryDays: 3 });
    await expect(referrals.checkout(buyer.id)).resolves.toEqual({ available: true });
    const body: CreateOrderDto = {
      useReferralCredit: true,
      items: [{ variantId: variant.id, quantity: 1 }],
      shippingAddress: {
        recipientName: 'کاربر آزمایش',
        phone: '09121234567',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'نشانی ساختگی آزمون',
        postalCode: '1234567890',
      },
    };

    const quote = () => orders.quotePrice(buyer.id, body);
    const [firstQuote, secondQuote] = await Promise.all([quote(), quote()]);
    expect(firstQuote).toMatchObject({
      payableToman: 20_000,
      discountTotalToman: 5_000,
      referralDiscountToman: 5_000,
    });
    const create = (quoteToken: string) => orders.createOrder(buyer.id, { ...body, quoteToken });
    const results = await Promise.allSettled([
      create(firstQuote.quoteToken),
      create(secondQuote.quoteToken),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
    const [accepted] = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    expect(accepted).toMatchObject({ grandTotalToman: 20_000, referralDiscountToman: 5_000 });
    const [failure] = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason as unknown] : [],
    );
    expect(failure).toMatchObject({ code: 'ORDER_PRICE_QUOTE_CHANGED' });
    await expect(
      db.orderPriceQuote.findUnique({ where: { orderId: accepted.id } }),
    ).resolves.toMatchObject({
      snapshot: {
        referral: {
          attributionId: claim.id,
          policyVersion: original.version,
          ruleCode: 'buyer-first',
          lineAmounts: [5_000],
        },
      },
    });
    await expect(referrals.checkout(buyer.id)).resolves.toEqual({ available: false });

    const initiatePayment = () =>
      payments.initiateOrderPayment(buyer.id, accepted.id, { idempotencyKey: randomUUID() });
    const failed = await initiatePayment();
    await expect(
      payments.verifyCallback(failed.attemptId, failed.authority!),
    ).rejects.toMatchObject({
      code: 'PAYMENT_FAILED',
    });
    await expect(referrals.checkout(buyer.id)).resolves.toEqual({ available: true });
    declinePayment = false;
    const attempt = await initiatePayment();
    await expect(
      db.paymentAttempt.findUnique({ where: { id: attempt.attemptId } }),
    ).resolves.toMatchObject({
      amountToman: 20_000,
    });
    await payments.verifyCallback(attempt.attemptId, attempt.authority!);
    await expect(referrals.overview(buyer.id, 1)).resolves.toMatchObject({
      incoming: { firstOrderId: accepted.id, status: 'FIRST_PURCHASE_CONFIRMED' },
    });
    await expect(referrals.checkout(buyer.id)).resolves.toEqual({ available: false });
    await expect(db.walletLot.count({ where: { source: 'REFERRAL' } })).resolves.toBe(0);
  } finally {
    await close();
  }
}, 120_000);
