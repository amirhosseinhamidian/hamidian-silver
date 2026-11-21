import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import {
  AttributionModel,
  OrderStatus,
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
          growthFunnelEvent: db.growthFunnelEvent,
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

        await order(before, inPeriod, 'desktop', true);
        await order(inPeriod, inPeriod, 'mobile');
        await order(inPeriod, null, 'mobile');
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
