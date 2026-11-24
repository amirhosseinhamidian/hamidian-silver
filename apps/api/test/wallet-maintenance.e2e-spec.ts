import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { PaymentAttemptStatus, PaymentStatus } from '../src/generated/prisma/enums';
import { RewardPoliciesService } from '../src/modules/reward-policies/reward-policies.service';
import { WalletCheckoutService } from '../src/modules/wallet/wallet-checkout.service';
import { WalletLedgerService } from '../src/modules/wallet/wallet-ledger.service';
import { WalletMaintenanceReportService } from '../src/modules/wallet/wallet-maintenance-report.service';
import { WalletMaintenanceService } from '../src/modules/wallet/wallet-maintenance.service';
import { createIsolatedTestDatabase } from './support/isolated-test-database';

const day = 86_400_000;

it('expires only uncommitted credit, recovers failed reservations, and reports balance drift', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const ledger = new WalletLedgerService(db);
  const checkout = new WalletCheckoutService(new RewardPoliciesService(db), ledger);
  const maintenance = new WalletMaintenanceService(db, ledger, checkout);
  const reports = new WalletMaintenanceReportService(db, new ConfigService());

  try {
    const now = new Date();
    const yesterday = new Date(+now - day);
    const tomorrow = new Date(+now + day);
    const user = await db.user.create({ data: { phone: '+00000000001' } });
    const warehouse = await db.warehouse.create({ data: { code: 'WL05', name: 'Wallet test' } });
    const policy = await db.rewardPolicyVersion.create({
      data: {
        requestId: randomUUID(),
        definition: { enabled: true, expiryDays: 270 },
        createdById: user.id,
        publishedById: user.id,
        publishedAt: yesterday,
        effectiveAt: yesterday,
      },
    });
    const origin = await db.order.create({
      data: {
        orderNumber: 'wl05-origin',
        userId: user.id,
        warehouseId: warehouse.id,
        status: 'PAID',
        paidAt: yesterday,
        createdAt: yesterday,
        reservationExpiresAt: tomorrow,
        merchandiseTotalToman: 30_000,
        grandTotalToman: 30_000,
        payment: { create: { status: 'PAID', amountToman: 30_000, paidAt: yesterday } },
      },
    });
    async function grantCredit(
      source: 'PURCHASE' | 'REFERRAL',
      amountToman: number,
      expiresAt: Date,
    ) {
      const grant = await ledger.grant({
        userId: user.id,
        orderId: origin.id,
        policyVersion: policy.version,
        source,
        sourceKey: source,
        amountToman,
        expiresAt,
        idempotencyKey: `grant:${source}`,
      });
      const lotId = grant.movements[0].lotId;
      await ledger.activate({ userId: user.id, lotId, idempotencyKey: `activate:${source}` });
      return lotId;
    }
    const expiringLot = await grantCredit('PURCHASE', 6_000, tomorrow);
    const futureLot = await grantCredit('REFERRAL', 2_000, new Date(+tomorrow + day));

    function createOrder(orderNumber: string, walletAppliedToman: number, overdue = true) {
      return db.order.create({
        data: {
          orderNumber,
          userId: user.id,
          warehouseId: warehouse.id,
          createdAt: yesterday,
          reservationExpiresAt: overdue ? now : tomorrow,
          merchandiseTotalToman: 30_000,
          grandTotalToman: 30_000 - walletAppliedToman,
          walletAppliedToman,
        },
      });
    }
    async function reserve(order: { id: string; walletAppliedToman: number }) {
      const operation = await ledger.reserve({
        userId: user.id,
        orderId: order.id,
        amountToman: order.walletAppliedToman,
        idempotencyKey: `reserve:${order.id}`,
      });
      const id = operation.movements[0].reservationId;
      if (!id) throw new Error('Expected a checkout reservation.');
      return id;
    }
    async function recordAttempt(
      order: { id: string; grandTotalToman: number },
      status: PaymentAttemptStatus,
      paymentStatus: PaymentStatus,
      provider: string,
    ) {
      const payment = await db.payment.create({
        data: { orderId: order.id, status: paymentStatus, amountToman: order.grandTotalToman },
      });
      return db.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          status,
          provider,
          amountToman: order.grandTotalToman,
          idempotencyKey: order.id,
          ...(status === 'REDIRECTED'
            ? { authority: order.id, paymentUrl: 'https://payments.example.test/checkout' }
            : {}),
          ...(status === 'FAILED' ? { failureMessage: 'Test payment declined.' } : {}),
          ...(status === 'AWAITING_REVIEW'
            ? {
                receiptData: Uint8Array.of(1),
                receiptMimeType: 'image/png',
                receiptOriginalName: 'test-receipt.png',
                receiptSizeBytes: 1,
                receiptUploadedAt: now,
              }
            : {}),
        },
      });
    }

    const uncertainOrder = await createOrder('wl05-unknown', 1_500);
    const uncertain = await reserve(uncertainOrder);
    const uncertainAttempt = await recordAttempt(uncertainOrder, 'REDIRECTED', 'PENDING', 'test');
    const receiptOrder = await createOrder('wl05-review', 1_000);
    const receipt = await reserve(receiptOrder);
    await recordAttempt(receiptOrder, 'AWAITING_REVIEW', 'AWAITING_REVIEW', 'card_to_card');
    const failedOrder = await createOrder('wl05-failed', 1_000);
    const failed = await reserve(failedOrder);
    await recordAttempt(failedOrder, 'FAILED', 'PENDING', 'test');
    const capturedOrder = await createOrder('wl05-captured', 500);
    const captured = await reserve(capturedOrder);
    await ledger.capture({ userId: user.id, reservationId: captured, idempotencyKey: 'capture' });

    // Advance the lot's test timeline without changing amount or payment evidence.
    const expiresAt = new Date(+now - 1);
    await db.walletLot.update({
      where: { id: expiringLot },
      data: { createdAt: yesterday, activatedAt: yesterday, expiresAt },
    });
    const newOrder = await createOrder('wl05-new', 1_000, false);
    await Promise.all([maintenance.expireBatch(), maintenance.expireBatch(), reserve(newOrder)]);
    await expect(db.walletLot.findUnique({ where: { id: expiringLot } })).resolves.toMatchObject({
      expiredToman: 2_000,
      availableToman: 0,
      reservedToman: 3_500,
      capturedToman: 500,
    });
    await expect(db.walletOperation.count({ where: { kind: 'EXPIRE' } })).resolves.toBe(1);
    await expect(db.walletLot.findUnique({ where: { id: futureLot } })).resolves.toMatchObject({
      availableToman: 1_000,
      reservedToman: 1_000,
    });

    await Promise.all([maintenance.reconcileReservations(), maintenance.reconcileReservations()]);
    await expect(db.walletReservation.findUnique({ where: { id: failed } })).resolves.toMatchObject(
      {
        status: 'RELEASED',
      },
    );
    await expect(
      db.walletReservation.findUnique({ where: { id: uncertain } }),
    ).resolves.toMatchObject({
      status: 'RESERVED',
    });
    await expect(
      db.walletReservation.findUnique({ where: { id: receipt } }),
    ).resolves.toMatchObject({
      status: 'RESERVED',
    });
    await expect(reports.report(1, 'open')).resolves.toMatchObject({
      totals: {
        availableToman: 1_000,
        expiredToman: 3_000,
        reservedToman: 3_500,
        capturedToman: 500,
      },
      issues: expect.arrayContaining([
        expect.objectContaining({ subjectId: uncertain, code: 'PAYMENT_UNCERTAIN' }),
        expect.objectContaining({ subjectId: receipt, code: 'RECEIPT_PENDING' }),
      ]),
    });
    await db.paymentAttempt.update({
      where: { id: uncertainAttempt.id },
      data: { status: 'FAILED', failureMessage: 'Test payment declined after inquiry.' },
    });
    await maintenance.reconcileReservations();
    await expect(reports.report(1, 'resolved')).resolves.toMatchObject({
      issues: [expect.objectContaining({ subjectId: uncertain, resolvedAt: expect.any(String) })],
    });
    await expect(db.walletOperation.count({ where: { kind: 'RELEASE' } })).resolves.toBe(2);

    await expect(maintenance.reconcileLots()).resolves.toMatchObject({ mismatches: 0 });
    await db.walletLot.update({
      where: { id: futureLot },
      data: { pendingToman: { increment: 100 }, availableToman: { decrement: 100 } },
    });
    await maintenance.reconcileLots();
    await expect(reports.report(1, 'open')).resolves.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ subjectId: futureLot, code: 'LEDGER_MISMATCH' }),
      ]),
    });
    await expect(db.walletLot.findUnique({ where: { id: futureLot } })).resolves.toMatchObject({
      pendingToman: 100,
      availableToman: 900,
    });
  } finally {
    await close();
  }
}, 120_000);
