import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import {
  AttributionModel,
  OrderCostEntryType,
  OrderReturnStatus,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentRefundStatus,
  PaymentStatus,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { RevenueEventKind } from '../src/modules/growth-attribution/dto/growth-revenue.dto';
import { GrowthRevenueService } from '../src/modules/growth-attribution/growth-revenue.service';

it('reconciles confirmed revenue and dated adjustments with the order lifecycle', async () => {
  const prisma = new PrismaService(new ConfigService());
  const rollback = new Error('Roll back the growth report fixtures');
  try {
    await prisma.$transaction(
      async (db) => {
        const suffix = randomUUID();
        const campaignId = `test-${suffix}`;
        const user = await db.user.create({
          data: { phone: `+0${suffix.replace(/\D/g, '').slice(0, 16)}` },
        });
        const reviewer = await db.user.create({
          data: { phone: `+1${suffix.replace(/\D/g, '').slice(0, 16)}` },
        });
        const warehouse = await db.warehouse.create({
          data: { code: `growth-${suffix}`, name: 'Growth report fixture' },
        });
        const start = new Date('2026-11-19T20:30:00.000Z');
        const end = new Date('2026-11-20T20:30:00.000Z');
        const before = new Date(start.valueOf() - 1);
        const during = new Date('2026-11-20T10:00:00.000Z');
        const touch = {
          source: 'newsletter',
          medium: 'email',
          campaignId,
          occurredAt: start.toISOString(),
        };
        const report = new GrowthRevenueService(db as unknown as PrismaService);
        const query = { from: '2026-11-20', to: '2026-11-20', campaignId };
        const receiptData = Uint8Array.from([1, 2, 3]);
        const receiptMetadata = {
          receiptData,
          receiptMimeType: 'image/png',
          receiptOriginalName: 'receipt.png',
          receiptSizeBytes: receiptData.byteLength,
        };

        function gatewayMetadata(label: string) {
          const authority = `${label}-${suffix}`;
          return {
            authority,
            paymentUrl: `https://payment.example.test/${authority}`,
            providerReference: `reference-${authority}`,
          };
        }

        function order(values: Partial<Prisma.OrderUncheckedCreateInput>) {
          return db.order.create({
            data: {
              orderNumber: `TEST-${randomUUID().slice(0, 24)}`,
              userId: user.id,
              warehouseId: warehouse.id,
              merchandiseTotalToman: 500,
              grandTotalToman: 500,
              createdAt: during,
              reservationExpiresAt: end,
              attribution: {
                create: {
                  source: touch.source,
                  medium: touch.medium,
                  campaignId,
                  attributedAt: start,
                  firstTouch: touch,
                  lastTouch: touch,
                  model: AttributionModel.LAST_NON_DIRECT,
                  policyVersion: 1,
                  windowDays: 30,
                },
              },
              ...values,
            },
          });
        }

        const paid = await order({
          createdAt: before,
          paidAt: start,
          deliveredAt: during,
          status: OrderStatus.DELIVERED,
          merchandiseTotalToman: 1700,
          discountTotalToman: 50,
          shippingTotalToman: 100,
          grandTotalToman: 1750,
          financeSnapshot: {
            create: {
              paidAt: start,
              merchandiseRevenueToman: 1700,
              platingRevenueToman: 0,
              discountToman: 50,
              shippingChargedToman: 100,
              taxToman: 0,
              customerTotalToman: 1750,
              supplierCostToman: 900,
              grossSalesToman: 1700,
              netSalesToman: 1650,
              grossMarginBeforeServiceCostsToman: 750,
            },
          },
          returns: { create: { status: OrderReturnStatus.RECEIVED, receivedAt: during } },
          payment: {
            create: {
              status: PaymentStatus.PARTIALLY_REFUNDED,
              paidAt: start,
              amountToman: 1750,
              refundedAmountToman: 150,
              refundAllocatedToman: 230,
              attempts: {
                create: [
                  {
                    idempotencyKey: `${suffix}-first`,
                    provider: 'irandargah',
                    ...gatewayMetadata('first'),
                    status: PaymentAttemptStatus.VERIFIED,
                    verifiedAt: start,
                    amountToman: 1750,
                  },
                  {
                    idempotencyKey: `${suffix}-duplicate`,
                    provider: 'irandargah',
                    ...gatewayMetadata('duplicate'),
                    status: PaymentAttemptStatus.VERIFIED,
                    verifiedAt: during,
                    amountToman: 1750,
                  },
                ],
              },
              refunds: {
                create: [
                  {
                    idempotencyKey: `${suffix}-refund`,
                    amountToman: 100,
                    status: PaymentRefundStatus.CONFIRMED,
                    confirmedAt: during,
                    confirmedByUserId: reviewer.id,
                    externalReference: `refund-${suffix}`,
                  },
                  {
                    idempotencyKey: `${suffix}-late-refund`,
                    amountToman: 50,
                    status: PaymentRefundStatus.CONFIRMED,
                    confirmedAt: end,
                    confirmedByUserId: reviewer.id,
                    externalReference: `late-refund-${suffix}`,
                  },
                  {
                    idempotencyKey: `${suffix}-pending-refund`,
                    amountToman: 80,
                    status: PaymentRefundStatus.PENDING,
                  },
                ],
              },
            },
          },
        });
        const fee = await db.orderCostEntry.create({
          data: {
            orderId: paid.id,
            type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
            amountToman: 25,
            source: 'fixture',
            idempotencyKey: `${suffix}-fee`,
            occurredAt: during,
          },
        });
        await db.orderCostEntry.createMany({
          data: [
            {
              orderId: paid.id,
              type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
              amountToman: -25,
              reversalOfId: fee.id,
              source: 'fixture',
              idempotencyKey: `${suffix}-reversal`,
              occurredAt: during,
            },
            {
              orderId: paid.id,
              type: OrderCostEntryType.SHIPPING_PROVIDER,
              amountToman: 75,
              source: 'fixture',
              idempotencyKey: `${suffix}-shipping`,
              occurredAt: during,
            },
          ],
        });
        const rejected = await order({
          payment: {
            create: {
              amountToman: 500,
              status: PaymentStatus.PENDING,
              attempts: {
                create: {
                  idempotencyKey: `${suffix}-rejected`,
                  provider: 'card_to_card',
                  amountToman: 500,
                  status: PaymentAttemptStatus.FAILED,
                  ...receiptMetadata,
                  receiptUploadedAt: during,
                  receiptRejectedAt: during,
                  failureCode: 'CARD_TO_CARD_RECEIPT_REJECTED',
                  failureMessage: 'The receipt amount did not match the order.',
                },
              },
            },
          },
        });
        await order({
          payment: {
            create: {
              amountToman: 500,
              status: PaymentStatus.AWAITING_REVIEW,
              attempts: {
                create: {
                  idempotencyKey: `${suffix}-awaiting`,
                  provider: 'card_to_card',
                  amountToman: 500,
                  status: PaymentAttemptStatus.AWAITING_REVIEW,
                  ...receiptMetadata,
                  receiptUploadedAt: during,
                },
              },
            },
          },
        });
        const lateGateway = gatewayMetadata('late');
        await order({
          status: OrderStatus.CANCELLED,
          cancelledAt: during,
          payment: {
            create: {
              amountToman: 500,
              status: PaymentStatus.RECONCILIATION_REQUIRED,
              attempts: {
                create: {
                  idempotencyKey: `${suffix}-late-callback`,
                  provider: 'irandargah',
                  ...lateGateway,
                  amountToman: 500,
                  status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
                  verifiedAt: during,
                  reconciliation: {
                    create: {
                      provider: 'irandargah',
                      providerReference: lateGateway.providerReference,
                      amountToman: 500,
                      detectedOrderStatus: OrderStatus.CANCELLED,
                      reason: 'Provider verified after cancellation',
                      createdAt: during,
                    },
                  },
                },
              },
            },
          },
        });
        const approvedReceipt = await order({
          createdAt: before,
          status: OrderStatus.PAID,
          paidAt: during,
          payment: {
            create: {
              amountToman: 500,
              status: PaymentStatus.PAID,
              paidAt: during,
              attempts: {
                create: {
                  idempotencyKey: `${suffix}-approved`,
                  provider: 'card_to_card',
                  amountToman: 500,
                  status: PaymentAttemptStatus.VERIFIED,
                  ...receiptMetadata,
                  providerReference: `card-${suffix}`,
                  verifiedAt: during,
                  receiptUploadedAt: before,
                  receiptVerifiedAt: during,
                  receiptVerifiedByUserId: reviewer.id,
                },
              },
            },
          },
        });
        await order({
          createdAt: end,
          status: OrderStatus.PAID,
          paidAt: end,
          payment: {
            create: {
              amountToman: 500,
              status: PaymentStatus.PAID,
              paidAt: end,
            },
          },
        });

        const summary = await report.summary(query);
        expect(summary).toMatchObject({
          currency: 'TOMAN',
          submittedOrderCount: 3,
          paidOrderCount: 2,
          attributedPaidOrderCount: 2,
          deliveredPaidOrderCount: 1,
          cancelledOrderCount: 1,
          paidOrderWithoutFinanceSnapshotCount: 1,
          receiptSubmittedCount: 2,
          awaitingReceiptReviewOrderCount: 1,
          receiptRejectedCount: 1,
          paymentReconciliationCount: 1,
          receivedReturnCount: 1,
          confirmedRefundCount: 1,
          collectedToman: 2250,
          refundedToman: 100,
          netCollectedToman: 2150,
          orderDiscountToman: 50,
          shippingChargedToman: 100,
          shippingProviderCostToman: 75,
          paymentChannelFeeToman: 0,
          walletAppliedToman: null,
          campaignDiscountToman: null,
          marketingChannelCostToman: null,
        });
        const confirmed = await report.events({
          ...query,
          kind: RevenueEventKind.PURCHASE_CONFIRMED,
        });
        expect(confirmed.total).toBe(summary.paidOrderCount);
        expect(confirmed.items.map(({ orderId }) => orderId)).toEqual([
          approvedReceipt.id,
          paid.id,
        ]);
        expect(confirmed.items[0]).toMatchObject({
          eventId: `purchase_confirmed:${approvedReceipt.id}`,
          provider: 'card_to_card',
        });
        expect(confirmed.items[0]).not.toHaveProperty('userId');
        expect(confirmed.items).not.toContainEqual(
          expect.objectContaining({ orderId: rejected.id }),
        );
        await expect(
          report.events({ ...query, kind: RevenueEventKind.PURCHASE_CONFIRMED, page: 3, limit: 1 }),
        ).resolves.toMatchObject({ total: 2, items: [] });
        await expect(
          report.summary({ ...query, from: '2026-11-21', to: '2026-11-21' }),
        ).resolves.toMatchObject({
          paidOrderCount: 1,
          refundedToman: 50,
          netCollectedToman: 450,
          paymentChannelFeeToman: null,
        });
        throw rollback;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
}, 20000);
