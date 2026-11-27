import { randomUUID } from 'node:crypto';
import {
  growthReviewPeriods,
  readGrowthCreditCommitments,
  readGrowthReviewPeriod,
} from '../src/modules/growth-attribution/growth-review';
import { createIsolatedTestDatabase } from './support/isolated-test-database';

it('reviews matured cohorts and credit using aggregate data and marks missing cost evidence', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  try {
    const buyer = await db.user.create({ data: { phone: '+01000000001' } });
    const warehouse = await db.warehouse.create({ data: { code: 'review', name: 'Review' } });
    const product = await db.product.create({
      data: {
        slug: 'growth-review-ring',
        name: 'Review ring',
        variants: { create: { sku: 'REVIEW-1' } },
      },
      include: { variants: true },
    });
    const variant = product.variants[0];
    async function order(day: string, kind: 'first' | 'repeat' | 'refunded') {
      const at = new Date(day + 'T12:00:00Z');
      const refund = kind === 'refunded';
      const discount = kind === 'repeat' ? 100 : 0;
      return db.order.create({
        data: {
          orderNumber: randomUUID().replaceAll('-', ''),
          userId: buyer.id,
          warehouseId: warehouse.id,
          status: 'PAID',
          merchandiseTotalToman: 10_000,
          discountTotalToman: discount,
          grandTotalToman: 10_000 - discount,
          createdAt: at,
          paidAt: at,
          reservationExpiresAt: at,
          payment: {
            create: {
              status: refund ? 'REFUNDED' : 'PAID',
              amountToman: 10_000 - discount,
              refundedAmountToman: refund ? 10_000 : 0,
              refundAllocatedToman: refund ? 10_000 : 0,
              paidAt: at,
              createdAt: at,
            },
          },
          items: {
            create: {
              variantId: variant.id,
              quantity: 1,
              productNameSnapshot: product.name,
              skuSnapshot: variant.sku,
              unitSalePriceToman: 10_000,
              lineTotalToman: 10_000,
              returnedQuantity: refund ? 1 : 0,
              returnAllocatedQuantity: refund ? 1 : 0,
            },
          },
        },
      });
    }
    await order('2020-01-01', 'refunded');
    const first = await order('2020-01-02', 'first');
    const repeat = await order('2020-01-16', 'repeat');
    const policy = await db.rewardPolicyVersion.create({
      data: { requestId: randomUUID(), createdById: buyer.id, definition: { enabled: true } },
    });
    await db.walletLot.create({
      data: {
        userId: buyer.id,
        orderId: first.id,
        source: 'PURCHASE',
        sourceKey: first.id,
        policyVersion: policy.version,
        createdAt: first.paidAt!,
        activatedAt: first.paidAt!,
        expiresAt: new Date('2020-02-02T12:00:00Z'),
        grantedToman: 1_000,
        pendingToman: 0,
        capturedToman: 650,
        expiredToman: 250,
        revokedToman: 100,
      },
    });
    const periods = growthReviewPeriods(['2020-01-01', '2020-01-07', '2020-01-10', '2020-01-16']);
    expect(() =>
      growthReviewPeriods(['2020-01-01', '2020-01-08', '2020-01-10', '2020-01-16']),
    ).toThrow();
    expect(() =>
      growthReviewPeriods(['2020-01-01', '2020-01-07', '2020-01-07', '2020-01-13']),
    ).toThrow();
    const baseline = await readGrowthReviewPeriod(db, periods.baseline);
    expect(baseline).toMatchObject({
      completePeriod: true,
      cohortMature: true,
      firstBuyers: '1',
      secondPurchaseWithin30Days: '1',
      secondPurchasePercent: '100.00',
      medianDaysToSecondPurchase: '14.00',
      retainedPurchases: '1',
      purchaseRewardIssuedToman: '1000',
      purchaseRewardConsumedPercent: '72.22',
      purchaseRewardExpiredPercent: '27.78',
      issuedRewardToNetCashPercent: '10.00',
      giftFinderUsagePercent: null,
      measuredVisits: null,
    });
    expect(JSON.stringify(baseline)).not.toContain(buyer.id);
    expect(await readGrowthReviewPeriod(db, periods.evaluation)).toMatchObject({
      repeatPurchases: '1',
      repeatPurchasesWithCostEvidence: '0',
      recordedIncentivePerRepeatPurchaseToman: null,
      secondPurchasePercent: null,
    });
    const campaign = await db.campaign.create({
      data: {
        slug: 'growth-review',
        name: 'Growth review',
        goal: 'Repeat purchase',
        channel: 'storefront',
        owner: { connect: { id: buyer.id } },
        tracking: { create: { id: 'growth-review', campaign: 'growth-review' } },
        allProducts: true,
        startsAt: new Date('2020-01-10T00:00:00Z'),
        endsAt: new Date('2020-01-17T00:00:00Z'),
        budgetToman: 1_000,
        message: 'Review fixture',
      },
    });
    await db.orderPriceQuote.create({
      data: {
        orderId: repeat.id,
        tokenHash: 'a'.repeat(64),
        campaignId: campaign.id,
        merchandiseDiscountToman: 100,
        shippingDiscountToman: 0,
        snapshot: {},
      },
    });
    await expect(readGrowthReviewPeriod(db, periods.evaluation)).resolves.toMatchObject({
      repeatPurchases: '1',
      repeatPurchasesWithCostEvidence: '1',
      recordedIncentivePerRepeatPurchaseToman: '100',
    });
    await expect(readGrowthCreditCommitments(db)).resolves.toMatchObject({
      commitment: {
        pendingToman: '0',
        availableToman: '0',
        reservedToman: '0',
        overduePendingOrAvailableToman: '0',
      },
    });
  } finally {
    await close();
  }
}, 120_000);
