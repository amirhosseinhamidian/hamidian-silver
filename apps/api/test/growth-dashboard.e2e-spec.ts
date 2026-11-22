import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import {
  AttributionModel,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentRefundStatus,
  PaymentStatus,
  ProductStatus,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { GrowthDashboardService } from '../src/modules/growth-attribution/growth-dashboard.service';
import { GrowthMeasurementService } from '../src/modules/growth-attribution/growth-measurement.service';
import { GrowthRevenueService } from '../src/modules/growth-attribution/growth-revenue.service';

it('reconciles confirmed orders and dated refunds, filters reports and records campaign spend once', async () => {
  const prisma = new PrismaService(new ConfigService());
  const rollback = new Error('Roll back growth dashboard fixtures');
  try {
    await prisma.$transaction(
      async (db) => {
        const suffix = randomUUID();
        const campaignId = `gm04-${suffix}`;
        const campaign = await db.campaignLinkIdentity.create({
          data: { id: campaignId, campaign: campaignId },
        });
        const source = 'newsletter';
        const medium = 'email';
        const user = await db.user.create({
          data: { phone: `+0${suffix.replace(/\D/g, '').slice(0, 16)}` },
        });
        const warehouse = await db.warehouse.create({
          data: { code: `growth-${suffix}`, name: 'Growth fixture' },
        });
        const category = await db.category.create({
          data: { slug: `category-${suffix}`, name: 'Growth fixture' },
        });
        const product = await db.product.create({
          data: {
            slug: `product-${suffix}`,
            name: 'Growth fixture',
            status: ProductStatus.ACTIVE,
            categories: { create: { categoryId: category.id } },
            variants: { create: { sku: `growth-${suffix}` } },
          },
          include: { variants: true },
        });
        const scoped = {
          $queryRaw: db.$queryRaw.bind(db),
          $transaction: (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => run(db),
          campaignLinkIdentity: db.campaignLinkIdentity,
          growthFunnelEvent: db.growthFunnelEvent,
          orderPriceQuote: db.orderPriceQuote,
        } as unknown as PrismaService;
        const dashboard = new GrowthDashboardService(scoped);
        const measurement = new GrowthMeasurementService(scoped);
        const revenue = new GrowthRevenueService(scoped);
        const period = { from: '2026-11-20', to: '2026-11-20', campaignId };
        const inPeriod = new Date('2026-11-20T10:00:00Z');
        const before = new Date('2026-11-19T15:00:00Z');
        const after = new Date('2026-11-20T20:30:00Z');
        const touch = {
          source,
          medium,
          campaign: campaign.campaign,
          campaignId,
          occurredAt: before.toISOString(),
        };

        async function order(
          createdAt: Date,
          paidAt: Date | null,
          device: 'mobile' | 'desktop',
          lateRefund = false,
        ) {
          const amountToman = 10_000;
          return db.order.create({
            data: {
              orderNumber: randomUUID().replaceAll('-', ''),
              userId: user.id,
              warehouseId: warehouse.id,
              createdAt,
              paidAt,
              reservationExpiresAt: after,
              growthDevice: device,
              status: paidAt ? OrderStatus.PAID : OrderStatus.PENDING_PAYMENT,
              merchandiseTotalToman: amountToman,
              grandTotalToman: amountToman,
              attribution: {
                create: {
                  source,
                  medium,
                  campaign: campaign.campaign,
                  campaignId,
                  firstTouch: touch,
                  lastTouch: touch,
                  attributedAt: before,
                  policyVersion: 1,
                  windowDays: 30,
                  model: AttributionModel.LAST_NON_DIRECT,
                },
              },
              items: {
                create: {
                  variantId: product.variants[0].id,
                  quantity: 1,
                  productNameSnapshot: product.name,
                  skuSnapshot: product.variants[0].sku,
                  unitSalePriceToman: amountToman,
                  lineTotalToman: amountToman,
                },
              },
              payment: {
                create: {
                  amountToman,
                  paidAt,
                  status: lateRefund
                    ? PaymentStatus.PARTIALLY_REFUNDED
                    : paidAt
                      ? PaymentStatus.PAID
                      : PaymentStatus.PENDING,
                  refundedAmountToman: lateRefund ? 500 : 0,
                  refundAllocatedToman: lateRefund ? 500 : 0,
                  ...(lateRefund
                    ? {
                        refunds: {
                          create: {
                            status: PaymentRefundStatus.CONFIRMED,
                            idempotencyKey: suffix,
                            amountToman: 500,
                            confirmedAt: after,
                            confirmedByUserId: user.id,
                            externalReference: suffix,
                            createdAt: inPeriod,
                          },
                        },
                      }
                    : {}),
                },
              },
            },
          });
        }

        const first = await order(before, inPeriod, 'desktop', true);
        const second = await order(inPeriod, inPeriod, 'mobile');
        const pending = await order(inPeriod, null, 'mobile');
        const observed = {
          visitId: randomUUID(),
          stage: 'view_item' as const,
          device: 'mobile' as const,
          id: randomUUID(),
          productSlugs: [product.slug],
          campaignId,
          campaign: campaign.campaign,
          source,
          medium,
        };
        await measurement.record(observed);
        await measurement.record(observed);
        const checkout = { ...observed, id: randomUUID(), stage: 'begin_checkout' as const };
        await measurement.record(checkout);
        await db.growthFunnelEvent.updateMany({
          where: { id: { in: [observed.id, checkout.id] } },
          data: { recordedAt: inPeriod },
        });
        const spend = {
          id: randomUUID(),
          amountToman: 5_000,
          source,
          medium,
          campaignId,
          day: period.from,
        };
        const saved = await dashboard.recordCost(spend);
        expect(await dashboard.recordCost(spend)).toEqual(saved);
        await expect(dashboard.recordCost({ ...spend, amountToman: 1 })).rejects.toThrow(
          'already used',
        );
        await dashboard.recordCost({ ...spend, id: randomUUID(), amountToman: -1_000 });

        const result = await dashboard.read(period);
        const financial = await revenue.summary(period);
        expect(result.totals).toMatchObject({
          confirmedCustomers: 1,
          submittedOrders: 2,
          confirmedOrders: financial.paidOrderCount,
          confirmedSubmissions: 1,
          conversionPercent: 50,
          collectedToman: financial.collectedToman,
          averageOrderToman: 10_000,
          netCollectedToman: 20_000,
          refundedToman: 0,
          recordedSpendToman: 4_000,
          recordedSpendPerConfirmedOrderToman: 2_000,
          measuredVisits: 1,
          itemViews: 1,
          checkouts: 1,
        });
        expect(result.items).toHaveLength(1);
        expect(await dashboard.read({ ...period, page: 2, limit: 1 })).toMatchObject({
          total: 1,
          items: [],
        });
        expect(await dashboard.costs({ ...period, page: 2, limit: 1 })).toMatchObject({
          total: 2,
          items: [expect.any(Object)],
        });
        expect(
          await dashboard.read({ ...period, category: category.slug, device: 'mobile' }),
        ).toMatchObject({
          totals: { confirmedOrders: 1, measuredVisits: 1, recordedSpendToman: null },
        });
        expect(await dashboard.read({ ...period, device: 'unknown' })).toMatchObject({
          totals: { confirmedOrders: 0, conversionPercent: null, measuredVisits: null },
        });
        expect(
          await dashboard.read({ ...period, from: '2026-11-21', to: '2026-11-21' }),
        ).toMatchObject({
          totals: { confirmedOrders: 0, refundedToman: 500, netCollectedToman: -500 },
        });

        const lifecycle = await db.campaign.create({
          data: {
            slug: campaignId,
            name: 'گزارش بازده نمونه',
            goal: 'تطبیق گزارش',
            channel: medium,
            ownerId: user.id,
            trackingId: campaignId,
            budgetToman: 6_000,
            plannedChannelCostToman: 3_000,
            allProducts: true,
            startsAt: before,
            endsAt: after,
            message: 'کمپین آزمایشی',
          },
        });
        const cancelled = await order(inPeriod, null, 'mobile');
        await db.order.update({
          where: { id: cancelled.id },
          data: {
            status: OrderStatus.CANCELLED,
            cancelledAt: inPeriod,
            payment: {
              update: {
                status: PaymentStatus.CANCELLED,
                attempts: {
                  create: {
                    idempotencyKey: `rejected-${suffix}`,
                    provider: 'card_to_card',
                    amountToman: 10_000,
                    status: PaymentAttemptStatus.FAILED,
                    receiptData: Uint8Array.from([1, 2, 3]),
                    receiptMimeType: 'image/png',
                    receiptOriginalName: 'receipt.png',
                    receiptSizeBytes: 3,
                    receiptUploadedAt: inPeriod,
                    receiptRejectedAt: inPeriod,
                    failureCode: 'CARD_TO_CARD_RECEIPT_REJECTED',
                    failureMessage: 'The receipt amount did not match the order.',
                  },
                },
              },
            },
          },
        });
        const otherCampaignId = `other-${suffix}`;
        await db.campaignLinkIdentity.create({
          data: { id: otherCampaignId, campaign: otherCampaignId },
        });
        const moved = await order(inPeriod, null, 'mobile');
        await db.orderAttribution.update({
          where: { orderId: moved.id },
          data: {
            campaignId: otherCampaignId,
            campaign: otherCampaignId,
            lastTouch: { ...touch, campaignId: otherCampaignId, campaign: otherCampaignId },
          },
        });
        await db.orderPriceQuote.createMany({
          data: [
            { orderId: first.id, merchandiseDiscountToman: 1000, shippingDiscountToman: 0 },
            { orderId: second.id, merchandiseDiscountToman: 0, shippingDiscountToman: 300 },
            { orderId: pending.id, merchandiseDiscountToman: 200, shippingDiscountToman: 0 },
            { orderId: cancelled.id, merchandiseDiscountToman: 550, shippingDiscountToman: 0 },
          ].map((item) => ({
            ...item,
            campaignId: lifecycle.id,
            tokenHash: '0'.repeat(64),
            snapshot: { version: 1 },
          })),
        });
        const performance = await dashboard.campaignPerformance(campaignId, period);
        expect(performance).toMatchObject({
          totals: { submittedOrders: 3, confirmedOrders: 2, measuredVisits: 1 },
          newCustomers: 1,
          cacToman: 4_000,
          roas: 5,
          merchandiseDiscountToman: 1_000,
          shippingDiscountToman: 300,
          consumedCreditToman: null,
          issuedRewardToman: null,
          outstandingRewardCommitmentToman: null,
          budget: {
            budgetToman: 6_000,
            lifetimeMediaSpendToman: 4_000,
            lifetimeCommittedDiscountToman: 1_500,
            unpaidDiscountCommitmentToman: 200,
            mediaVarianceToman: 1_000,
            budgetVarianceToman: -500,
          },
        });
        expect(performance.history).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ kind: 'cancellation', orderId: cancelled.id }),
            expect.objectContaining({
              kind: 'attribution',
              orderId: moved.id,
              firstCampaignId: campaignId,
              lastCampaignId: otherCampaignId,
              selectedCampaignId: otherCampaignId,
            }),
          ]),
        );
        const nextDay = { from: '2026-11-21', to: '2026-11-21' };
        await expect(dashboard.campaignPerformance(campaignId, nextDay)).resolves.toMatchObject({
          totals: { confirmedOrders: 0, refundedToman: 500 },
          cacToman: null,
          roas: null,
          merchandiseDiscountToman: 0,
          budget: performance.budget,
        });
        await expect(dashboard.campaignPerformance(otherCampaignId, period)).resolves.toMatchObject(
          {
            budget: null,
            merchandiseDiscountToman: null,
            cacToman: null,
            roas: null,
          },
        );
        const previous = await order(before, before, 'desktop');
        await db.orderAttribution.update({
          where: { orderId: previous.id },
          data: { campaignId: otherCampaignId, campaign: otherCampaignId },
        });
        await expect(dashboard.campaignPerformance(campaignId, period)).resolves.toMatchObject({
          totals: { confirmedOrders: 2 },
          newCustomers: 0,
          cacToman: null,
          roas: 5,
        });
        throw rollback;
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
}, 30_000);
