import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ReferralsService } from '../src/modules/referrals/referrals.service';
import { createIsolatedTestDatabase } from './support/isolated-test-database';
import { seedReferralPurchase } from './support/referral-purchase';

it('stores one attribution before first payment, confirms it once and never grants credit', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const referrals = new ReferralsService(db, new ConfigService({ REFERRALS_ENABLED: true }));
  const day = 86_400_000;
  const before = new Date(Date.now() - day);

  try {
    const [first, second, buyer, existing, unverified, expired, concurrent] = await Promise.all(
      Array.from({ length: 7 }, (_, index) =>
        db.user.create({
          data: { phone: `+98912010000${index}`, phoneVerifiedAt: index === 4 ? null : before },
        }),
      ),
    );
    const warehouse = await db.warehouse.create({
      data: { name: 'Referral test', code: `rf01-${randomUUID()}` },
    });
    async function order(userId: string) {
      return db.order.create({
        data: {
          orderNumber: randomUUID().replaceAll('-', ''),
          userId,
          warehouseId: warehouse.id,
          createdAt: before,
          reservationExpiresAt: new Date(Date.now() + day),
          merchandiseTotalToman: 25_000,
          grandTotalToman: 25_000,
          payment: { create: { amountToman: 25_000 } },
        },
      });
    }
    async function confirm(orderId: string) {
      await db.$transaction(async (tx) => {
        const paidAt = new Date();
        await tx.order.update({ where: { id: orderId }, data: { status: 'PAID', paidAt } });
        await tx.payment.update({ where: { orderId }, data: { status: 'PAID', paidAt } });
      });
    }
    await expect(referrals.overview(first.id, 1)).resolves.toMatchObject({
      referrerEligible: false,
      code: null,
    });
    await expect(referrals.issueCode(first.id)).rejects.toMatchObject({
      code: 'REFERRAL_REFERRER_PURCHASE_REQUIRED',
    });
    await confirm((await order(first.id)).id);
    await expect(referrals.issueCode(first.id)).rejects.toMatchObject({
      code: 'REFERRAL_REFERRER_PURCHASE_REQUIRED',
    });
    const oldCode = await db.referralCode.create({
      data: { userId: expired.id, code: 'ABCDEFGHIJKLMNOPQRSTUVWX' },
    });
    await expect(referrals.claim(buyer.id, oldCode.code)).rejects.toMatchObject({
      code: 'REFERRAL_REFERRER_PURCHASE_REQUIRED',
    });
    const firstPurchase = await seedReferralPurchase(db, first.id);
    const secondPurchase = await seedReferralPurchase(db, second.id);
    const firstCode = await referrals.issueCode(first.id);
    const secondCode = await referrals.issueCode(second.id);
    expect(firstCode.code).toMatch(/^[A-Za-z0-9_-]{24}$/);
    await expect(referrals.issueCode(first.id)).resolves.toEqual(firstCode);
    await expect(referrals.claim(first.id, firstCode.code)).rejects.toMatchObject({
      code: 'REFERRAL_SELF',
    });
    await expect(referrals.claim(unverified.id, firstCode.code)).rejects.toMatchObject({
      code: 'REFERRAL_VERIFICATION_REQUIRED',
    });
    await confirm((await order(existing.id)).id);
    await expect(referrals.claim(existing.id, firstCode.code)).rejects.toMatchObject({
      code: 'REFERRAL_FIRST_PURCHASE_EXISTS',
    });
    const result = await Promise.allSettled([
      referrals.claim(buyer.id, firstCode.code),
      referrals.claim(buyer.id, secondCode.code),
    ]);
    expect(result.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
    const [accepted] = result.flatMap((entry, index) =>
      entry.status === 'fulfilled'
        ? [
            {
              claim: entry.value,
              referrer: index === 0 ? first : second,
              code: index === 0 ? firstCode : secondCode,
            },
          ]
        : [],
    );
    if (!accepted) throw new Error('Expected a referral to be accepted');
    expect(accepted.claim.status).toBe('PENDING');
    await expect(
      db.referralAttribution.findUnique({ where: { id: accepted.claim.id } }),
    ).resolves.toMatchObject({
      referrerPurchaseOrderId:
        accepted.referrer.id === first.id ? firstPurchase.id : secondPurchase.id,
    });
    await expect(referrals.claim(buyer.id, accepted.code.code)).resolves.toMatchObject({
      id: accepted.claim.id,
    });
    await expect(referrals.overview(accepted.referrer.id, 1)).resolves.toMatchObject({
      outgoing: { items: [expect.objectContaining({ id: accepted.claim.id })], hasMore: false },
    });

    const unpaid = await order(buyer.id);
    const pendingPayment = await db.payment.update({
      where: { orderId: unpaid.id },
      data: { status: 'AWAITING_REVIEW' },
    });
    const receipt = await db.paymentAttempt.create({
      data: {
        paymentId: pendingPayment.id,
        idempotencyKey: randomUUID(),
        amountToman: pendingPayment.amountToman,
        provider: 'card_to_card',
        status: 'AWAITING_REVIEW',
        receiptData: Uint8Array.of(1),
        receiptMimeType: 'image/png',
        receiptOriginalName: 'test-receipt.png',
        receiptSizeBytes: 1,
        receiptUploadedAt: new Date(),
      },
    });
    await expect(referrals.overview(buyer.id, 1)).resolves.toMatchObject({
      incoming: { status: 'PENDING' },
    });
    await db.paymentAttempt.update({
      where: { id: receipt.id },
      data: {
        status: 'FAILED',
        failureCode: 'CARD_TO_CARD_RECEIPT_REJECTED',
        failureMessage: 'Test receipt rejected',
        receiptRejectedAt: new Date(),
      },
    });
    await db.payment.update({ where: { orderId: unpaid.id }, data: { status: 'PENDING' } });
    await expect(referrals.overview(buyer.id, 1)).resolves.toMatchObject({
      incoming: { status: 'PENDING' },
    });

    const paid = await order(buyer.id);
    await confirm(paid.id);
    await confirm((await order(buyer.id)).id);
    await expect(referrals.overview(buyer.id, 1)).resolves.toMatchObject({
      incoming: {
        id: accepted.claim.id,
        status: 'FIRST_PURCHASE_CONFIRMED',
        firstOrderId: paid.id,
      },
    });
    await expect(db.walletLot.count({ where: { source: 'REFERRAL' } })).resolves.toBe(0);

    await referrals.claim(expired.id, firstCode.code);
    await db.referralAttribution.update({
      where: { referredUserId: expired.id },
      data: { claimedAt: new Date(+before - day), expiresAt: before },
    });
    await confirm((await order(expired.id)).id);
    await expect(referrals.overview(expired.id, 1)).resolves.toMatchObject({
      incoming: { status: 'EXPIRED', firstOrderId: null },
    });
    const firstConcurrentOrder = await order(concurrent.id);
    const [racedClaim, racedPayment] = await Promise.allSettled([
      referrals.claim(concurrent.id, firstCode.code),
      confirm(firstConcurrentOrder.id),
    ]);
    expect(racedPayment.status).toBe('fulfilled');
    await confirm((await order(concurrent.id)).id);
    if (racedClaim.status === 'fulfilled') {
      await expect(
        db.referralAttribution.findUnique({ where: { referredUserId: concurrent.id } }),
      ).resolves.toMatchObject({
        firstOrderId: firstConcurrentOrder.id,
      });
    } else {
      expect(racedClaim.reason).toMatchObject({ code: 'REFERRAL_FIRST_PURCHASE_EXISTS' });
      await expect(referrals.overview(concurrent.id, 1)).resolves.toMatchObject({ incoming: null });
    }

    await db.referralRequestLimit.update({ where: { userId: first.id }, data: { attempts: 10 } });
    await expect(referrals.issueCode(first.id)).rejects.toMatchObject({ status: 429 });
    await db.referralRequestLimit.update({
      where: { userId: first.id },
      data: { windowStartAt: before },
    });
    await expect(referrals.issueCode(first.id)).resolves.toEqual(firstCode);
  } finally {
    await close();
  }
}, 120_000);
