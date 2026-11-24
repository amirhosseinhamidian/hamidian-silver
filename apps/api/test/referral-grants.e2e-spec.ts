import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../src/generated/prisma/client';
import { ReferralGrantReportService } from '../src/modules/referrals/referral-grant-report.service';
import { ReferralGrantWorker } from '../src/modules/referrals/referral-grant.worker';
import { defaultReferralRiskPolicy } from '../src/modules/referrals/referral-risk-engine';
import { ReferralsService } from '../src/modules/referrals/referrals.service';
import { RewardPoliciesService } from '../src/modules/reward-policies/reward-policies.service';
import { WalletLedgerService } from '../src/modules/wallet/wallet-ledger.service';
import { createIsolatedTestDatabase } from './support/isolated-test-database';
import { seedReferralPurchase } from './support/referral-purchase';

it('grants the referrer once after risk approval and corrects a returned purchase', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const config = new ConfigService({ REFERRALS_ENABLED: true });
  const referrals = new ReferralsService(db, config);
  const ledger = new WalletLedgerService(db);
  const reports = new ReferralGrantReportService(db);
  const worker = new ReferralGrantWorker(db, ledger, new RewardPoliciesService(db), config);
  try {
    const [referrer, buyer] = await Promise.all(
      ['+989120114001', '+989120114002'].map((phone) =>
        db.user.create({ data: { phone, phoneVerifiedAt: new Date() } }),
      ),
    );
    const effectiveAt = new Date(Date.now() - 86_400_000);
    const publication = {
      createdById: referrer.id,
      publishedById: referrer.id,
      effectiveAt,
      publishedAt: effectiveAt,
    };
    await db.rewardPolicyVersion.create({
      data: {
        ...publication,
        requestId: randomUUID(),
        definition: {
          enabled: true,
          budget: {
            incentivesPerOrderToman: 50_000,
            incentivesPerPeriodToman: 50_000,
            incentivesPerCustomerPeriodToman: 50_000,
          },
        },
      },
    });
    const policy = await db.referralRewardPolicyVersion.create({
      data: {
        ...publication,
        requestId: randomUUID(),
        definition: {
          enabled: true,
          periodBudgetToman: 3_000,
          rules: [
            {
              code: 'inviter',
              enabled: true,
              recipient: 'REFERRER',
              priority: 1,
              purchaseRank: 'FIRST',
              method: 'PERCENT',
              value: 2000,
              minimumToman: 1,
              capToman: 10_000,
              expiryDays: 12,
              maxUsesPerRecipient: 2,
              periodBudgetToman: 10000,
              campaignIds: [],
              allowedCategoryIds: [],
              allowCampaign: false,
              allowCoupon: false,
              allowPurchaseReward: false,
            },
          ],
        },
      },
    });
    await seedReferralPurchase(db, referrer.id);
    const { code } = await referrals.issueCode(referrer.id);
    const claim = await referrals.claim(buyer.id, code);
    const [{ paidAt }] = await db.$queryRaw<{ paidAt: Date }[]>`
      SELECT clock_timestamp()::timestamptz(3) AS "paidAt"
    `;
    const order = await seedReferralPurchase(db, buyer.id, paidAt);
    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          discountTotalToman: 1_000,
          grandTotalToman: 24_000,
          referralDiscountToman: 1_000,
          referralCheckoutAttributionId: claim.id,
          referralCheckoutRuleCode: 'buyer-first',
          referralCheckoutExpiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      await tx.payment.update({
        where: { orderId: order.id },
        data: { status: 'PAID', amountToman: 24_000 },
      });
    });
    await worker.run();
    await expect(db.walletLot.count({ where: { source: 'REFERRAL' } })).resolves.toBe(0);

    await db.referralRiskAssessment.create({
      data: {
        attributionId: claim.id,
        orderId: order.id,
        action: 'HOLD',
        autoAction: 'HOLD',
        score: 0,
        confidence: 'LOW',
        policySnapshot: JSON.parse(
          JSON.stringify(defaultReferralRiskPolicy()),
        ) as Prisma.InputJsonObject,
        assessedAt: new Date(),
        dueAt: new Date(Date.now() + 86_400_000),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await worker.run();
    await expect(db.walletLot.count({ where: { source: 'REFERRAL' } })).resolves.toBe(0);
    const pendingReturn = await db.orderReturn.create({ data: { orderId: order.id } });
    await db.referralRiskAssessment.update({
      where: { attributionId: claim.id },
      data: { action: 'ALLOW', dueAt: null, revision: 2 },
    });
    await expect(
      db.referralGrantJob.findUniqueOrThrow({ where: { attributionId: claim.id } }),
    ).resolves.toMatchObject({ nextAttemptAt: expect.any(Date) });
    await worker.run();
    await expect(
      db.referralGrantJob.findUnique({ where: { attributionId: claim.id } }),
    ).resolves.toMatchObject({
      status: 'PENDING',
      resultCode: 'RETURN_PENDING',
      riskRevision: 2,
    });
    await db.orderReturn.update({
      where: { id: pendingReturn.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await Promise.all([worker.run(), worker.run()]);
    const expected = { userId: referrer.id, source: 'REFERRAL' as const, sourceKey: claim.id };
    const lot = await db.walletLot.findFirstOrThrow({ where: expected });
    expect(lot).toMatchObject({
      orderId: order.id,
      referralPolicyVersion: policy.version,
      grantedToman: 2_000,
      availableToman: 2_000,
      pendingToman: 0,
    });
    expect(+lot.expiresAt - +lot.createdAt).toBeGreaterThan(12 * 86_400_000 - 5000);
    expect(+lot.expiresAt - +lot.createdAt).toBeLessThanOrEqual(12 * 86_400_000);
    await expect(db.walletLot.count({ where: expected })).resolves.toBe(1);
    await expect(db.walletOperation.count({ where: { userId: referrer.id } })).resolves.toBe(2);
    await expect(reports.report({ status: 'APPROVED' })).resolves.toMatchObject({
      totals: {
        registered: 1,
        converted: 1,
        approved: 1,
        grantedToman: 2_000,
        buyerDiscountToman: 1_000,
      },
      items: [{ id: claim.id, status: 'APPROVED', policyVersion: policy.version }],
    });

    const { warehouseId } = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    const spendOrder = await db.order.create({
      data: {
        warehouseId,
        userId: referrer.id,
        orderNumber: 'referral-reward-spend',
        reservationExpiresAt: new Date(Date.now() + 600_000),
        merchandiseTotalToman: 25_000,
        grandTotalToman: 24_000,
        walletAppliedToman: 1_000,
      },
    });
    const reservation = await ledger.reserve({
      userId: referrer.id,
      orderId: spendOrder.id,
      amountToman: 1_000,
      idempotencyKey: randomUUID(),
    });
    const reservationId = reservation.movements[0].reservationId!;
    await ledger.capture({ userId: referrer.id, reservationId, idempotencyKey: randomUUID() });
    await db.orderItem.updateMany({
      where: { orderId: order.id },
      data: {
        returnedQuantity: 1,
        returnAllocatedQuantity: 1,
      },
    });
    await expect(ledger.balance(referrer.id)).resolves.toMatchObject({ availableToman: 0 });
    await worker.run();
    await expect(db.walletLot.findUnique({ where: { id: lot.id } })).resolves.toMatchObject({
      revokedToman: 1_000,
      availableToman: 0,
      capturedToman: 1_000,
    });
    const correction = await db.referralGrantJob.findUniqueOrThrow({
      where: { attributionId: claim.id },
    });
    expect(correction).toMatchObject({
      status: 'REJECTED',
      recoveryDueToman: 1_000,
      nextAttemptAt: expect.any(Date),
    });
    await ledger.reverseCapture({
      userId: referrer.id,
      reservationId,
      amountToman: 1_000,
      idempotencyKey: randomUUID(),
    });
    await expect(ledger.balance(referrer.id)).resolves.toMatchObject({ availableToman: 0 });
    await worker.run(correction.nextAttemptAt!);
    await expect(db.walletLot.findUnique({ where: { id: lot.id } })).resolves.toMatchObject({
      revokedToman: 2_000,
      availableToman: 0,
      capturedToman: 0,
    });
    await expect(reports.report({ status: 'REJECTED' })).resolves.toMatchObject({
      totals: { converted: 0, rejected: 1, revokedToman: 2_000, recoveryDueToman: 0 },
    });
  } finally {
    await close();
  }
}, 120_000);
