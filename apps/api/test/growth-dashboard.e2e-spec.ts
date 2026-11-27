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
        const brand = await db.brand.create({
          data: { slug: `brand-${suffix}`, name: 'Growth fixture' },
        });
        const product = await db.product.create({
          data: {
            slug: `product-${suffix}`,
            name: 'Growth fixture',
            status: ProductStatus.ACTIVE,
            brandId: brand.id,
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
          content: 'hero',
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
                  content: touch.content,
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
        const anotherView = { ...observed, id: randomUUID() };
        await measurement.record(anotherView);
        const checkout = { ...observed, id: randomUUID(), stage: 'begin_checkout' as const };
        await measurement.record(checkout);
        await db.growthFunnelEvent.updateMany({
          where: { id: { in: [observed.id, anotherView.id, checkout.id] } },
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
          newCustomers: 1,
          returningCustomers: 0,
          campaignAttributedOrders: 2,
          walletAppliedToman: null,
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
          itemViews: 2,
          checkouts: 1,
        });
        expect(result.visitStages).toEqual({ itemList: 0, item: 1, cart: 0, checkout: 1 });
        expect(result.daily).toEqual([
          expect.objectContaining({
            day: period.from,
            confirmedOrders: 2,
            campaignAttributedOrders: 2,
            newCustomers: 1,
            netCollectedToman: 20_000,
            walletAppliedToman: null,
          }),
        ]);
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
          await dashboard.read({
            ...period,
            category: category.slug,
            product: product.slug,
            brand: brand.slug,
            device: 'mobile',
          }),
        ).toMatchObject({
          totals: { confirmedOrders: 1, measuredVisits: 1, recordedSpendToman: null },
        });
        expect(
          await dashboard.read({ ...period, product: product.slug, brand: 'other-brand' }),
        ).toMatchObject({
          totals: { confirmedOrders: 0, recordedSpendToman: null },
          visitStages: null,
          items: [],
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
        const quota = await db.campaignQuota.create({
          data: { campaignId: lifecycle.id, productId: product.id, limit: 10, manualSold: 1 },
        });
        await db.campaignQuotaAllocation.createMany({
          data: [
            { quotaId: quota.id, orderId: first.id, quantity: 2, state: 'CAPTURED' },
            { quotaId: quota.id, orderId: pending.id, quantity: 3, state: 'RESERVED' },
          ],
        });
        const performance = await dashboard.campaignPerformance(campaignId, period);
        expect(performance).toMatchObject({
          campaignType: 'LEGACY',
          managedCampaignId: lifecycle.id,
          spendCoverage: 'MATCHED',
          totals: { submittedOrders: 3, confirmedOrders: 2, measuredVisits: 1 },
          offer: {
            submittedOrders: 3,
            confirmedOrders: 2,
            collectedToman: 20_000,
            refundedToman: 0,
            quota: {
              products: 1,
              limit: 10,
              manualSold: 1,
              siteSold: 2,
              reserved: 3,
              remaining: 4,
            },
          },
          channels: [{ source, medium, confirmedOrders: 2, recordedSpendToman: 4_000 }],
          trackingContents: [
            {
              source,
              medium,
              content: 'hero',
              submittedOrders: 3,
              confirmedOrders: 2,
              netCollectedToman: 20_000,
            },
          ],
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
            remainingDiscountToman: 1_500,
            mediaVarianceToman: 1_000,
            budgetVarianceToman: -500,
          },
        });
        await expect(
          dashboard.campaignPerformance(campaignId, { ...period, contentPage: 2 }),
        ).resolves.toMatchObject({
          contentPage: 2,
          trackingContents: [],
          hasMoreTrackingContents: false,
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
          offer: { confirmedOrders: 0, refundedToman: 500, netCollectedToman: -500 },
          trackingContents: [
            { content: 'hero', submittedOrders: 0, confirmedOrders: 0, netCollectedToman: -500 },
          ],
          cacToman: null,
          roas: null,
          merchandiseDiscountToman: 0,
          budget: performance.budget,
        });
        await expect(dashboard.campaignPerformance(otherCampaignId, period)).resolves.toMatchObject(
          {
            campaignType: 'TRACKING_ONLY',
            offer: null,
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
          totals: { confirmedOrders: 2, newCustomers: 0, returningCustomers: 1 },
          newCustomers: 0,
          cacToman: null,
          roas: 5,
        });
        await dashboard.recordCost({
          ...spend,
          id: randomUUID(),
          day: nextDay.from,
          amountToman: 1_000,
        });
        const extended = await dashboard.read({ ...period, to: nextDay.to, sort: 'net' });
        expect(extended.totals).toMatchObject({
          recordedSpendToman: 5_000,
          recordedSpendPerConfirmedOrderToman: 2_500,
          confirmedOrders: 2,
          refundedToman: 500,
          netCollectedToman: 19_500,
        });
        expect(
          extended.daily.map(({ day, netCollectedToman }) => [day, netCollectedToman]),
        ).toEqual([
          [period.from, 20_000],
          [nextDay.from, -500],
        ]);
        await db.orderFinanceSnapshot.createMany({
          data: [first.id, second.id].map((orderId) => ({
            orderId,
            paidAt: inPeriod,
            merchandiseRevenueToman: 10_300,
            platingRevenueToman: 0,
            discountToman: 100,
            shippingChargedToman: 0,
            taxToman: 0,
            customerTotalToman: 10_000,
            walletAppliedToman: 200,
            supplierCostToman: 0,
            grossSalesToman: 10_300,
            netSalesToman: 10_200,
            grossMarginBeforeServiceCostsToman: 10_200,
          })),
        });
        await expect(dashboard.read({ ...period, sort: 'spend' })).resolves.toMatchObject({
          totals: { orderDiscountToman: 200, walletAppliedToman: 400 },
          daily: [{ day: period.from, orderDiscountToman: 200, walletAppliedToman: 400 }],
        });
        // A paid order came from the marketing link but applied the sales campaign's quote.
        await db.campaign.update({
          where: { id: lifecycle.id },
          data: { managementPurpose: 'SALES', channel: 'sales', plannedChannelCostToman: null },
        });
        await db.campaign.create({
          data: {
            slug: otherCampaignId,
            trackingId: otherCampaignId,
            name: 'تبلیغات نمونه',
            kind: 'MARKETING',
            goal: 'تطبیق انتساب و تخفیف',
            channel: medium,
            ownerId: user.id,
            budgetToman: 2_000,
            plannedChannelCostToman: 2_000,
            allProducts: true,
            startsAt: before,
            endsAt: after,
            message: 'تبلیغات نمونه',
            marketingDestinationPath: '/products',
            relatedSalesCampaignId: lifecycle.id,
          },
        });
        await db.orderAttribution.update({
          where: { orderId: first.id },
          data: { campaignId: otherCampaignId, campaign: otherCampaignId },
        });
        const bothDays = { from: period.from, to: nextDay.to };
        await expect(dashboard.campaignPerformance(campaignId, bothDays)).resolves.toMatchObject({
          campaignType: 'SALES',
          consumedCreditToman: 200,
          totals: { confirmedOrders: 1, refundedToman: 0, netCollectedToman: 10_000 },
          offer: {
            confirmedOrders: 2,
            refundedToman: 500,
            netCollectedToman: 19_500,
            quota: { manualSold: 1, siteSold: 2, reserved: 3, remaining: 4 },
          },
          merchandiseDiscountToman: 1_000,
          shippingDiscountToman: 300,
          budget: { remainingDiscountToman: 4_500 },
        });
        await expect(
          dashboard.campaignPerformance(otherCampaignId, bothDays),
        ).resolves.toMatchObject({
          campaignType: 'MARKETING',
          spendCoverage: 'NO_COST',
          cacToman: null,
          roas: null,
          offer: null,
          totals: { confirmedOrders: 1, refundedToman: 500, netCollectedToman: 9_500 },
          trackingContents: [{ content: 'hero', confirmedOrders: 1, netCollectedToman: 9_500 }],
        });
        await db.orderAttribution.update({
          where: { orderId: second.id },
          data: { source: 'uncovered' },
        });
        await expect(dashboard.campaignPerformance(campaignId, bothDays)).resolves.toMatchObject({
          spendCoverage: 'INCOMPLETE_COST',
          roas: null,
          cacToman: null,
        });

        const rankSource = `ranking-${suffix}`;
        const cohorts = [
          { medium: 'email', id: campaignId, submitted: 10, confirmed: 7 },
          { medium: 'email', id: otherCampaignId, submitted: 10, confirmed: 8 },
          { medium: 'sms', id: campaignId, submitted: 12, confirmed: 12 },
          { medium: 'sms', id: otherCampaignId, submitted: 8, confirmed: 4 },
          { medium: 'social', id: otherCampaignId, submitted: 1, confirmed: 1 },
        ];
        const rankedOrders = cohorts.flatMap((cohort) =>
          Array.from({ length: cohort.submitted }, (_, index) => ({
            cohort,
            id: randomUUID(),
            paidAt: index < cohort.confirmed ? inPeriod : null,
          })),
        );
        await db.order.createMany({
          data: rankedOrders.map(({ id, paidAt }) => ({
            id,
            paidAt,
            orderNumber: id.replaceAll('-', ''),
            userId: user.id,
            warehouseId: warehouse.id,
            createdAt: inPeriod,
            reservationExpiresAt: after,
            status: paidAt ? OrderStatus.PAID : OrderStatus.PENDING_PAYMENT,
            merchandiseTotalToman: 10_000,
            grandTotalToman: 10_000,
          })),
        });
        await db.payment.createMany({
          data: rankedOrders.map(({ id, paidAt }) => ({
            orderId: id,
            paidAt,
            amountToman: 10_000,
            status: paidAt ? PaymentStatus.PAID : PaymentStatus.PENDING,
          })),
        });
        await db.orderAttribution.createMany({
          data: rankedOrders.map(({ cohort, id }) => ({
            orderId: id,
            policyVersion: 1,
            windowDays: 30,
            model: AttributionModel.LAST_NON_DIRECT,
            firstTouch: {
              ...touch,
              source: rankSource,
              medium: cohort.medium,
              campaignId: cohort.id,
              campaign: cohort.id,
            },
            lastTouch: {
              ...touch,
              source: rankSource,
              medium: cohort.medium,
              campaignId: cohort.id,
              campaign: cohort.id,
            },
            campaignId: cohort.id,
            campaign: cohort.id,
            source: rankSource,
            medium: cohort.medium,
            attributedAt: before,
          })),
        });
        const rankQuery = {
          from: period.from,
          to: period.to,
          source: rankSource,
          page: 99,
          limit: 1,
        };
        await expect(dashboard.read(rankQuery)).resolves.toMatchObject({
          items: [],
          total: 5,
          leadingCampaign: { campaignId, confirmedOrders: 19 },
          leadingChannel: { medium: 'sms', submittedOrders: 20, confirmedSubmissions: 16 },
          minimumChannelOrders: 20,
        });
        const tiedOrders = rankedOrders
          .filter(({ cohort, paidAt }) => cohort.id === campaignId && paidAt)
          .slice(0, 3);
        await db.orderAttribution.updateMany({
          where: { orderId: { in: tiedOrders.map(({ id }) => id) } },
          data: { campaignId: otherCampaignId, campaign: otherCampaignId },
        });
        await expect(dashboard.read(rankQuery)).resolves.toMatchObject({ leadingCampaign: null });
        const completed = rankedOrders.find(
          ({ cohort, paidAt }) => cohort.medium === 'email' && !paidAt,
        )!;
        await db.order.update({
          where: { id: completed.id },
          data: {
            status: OrderStatus.PAID,
            paidAt: inPeriod,
            payment: { update: { status: PaymentStatus.PAID, paidAt: inPeriod } },
          },
        });
        await expect(dashboard.read(rankQuery)).resolves.toMatchObject({ leadingChannel: null });
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
