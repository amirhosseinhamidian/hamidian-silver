import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { NotificationOutboxWorker } from '../src/modules/notifications/notification-outbox.worker';
import { WalletCreditNotificationsService } from '../src/modules/notifications/wallet-credit-notifications.service';
import { WalletLedgerService } from '../src/modules/wallet/wallet-ledger.service';
import { createIsolatedTestDatabase } from './support/isolated-test-database';
import { seedReferralPurchase } from './support/referral-purchase';

it('queues one transactional SMS on activation and retries without altering the activated credit', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const wallet = new WalletLedgerService(db);
  const notifications = new WalletCreditNotificationsService(db);
  const sendMessage = jest
    .fn<() => Promise<void>>()
    .mockRejectedValueOnce(new Error('Provider unavailable'))
    .mockResolvedValue(undefined);
  const worker = new NotificationOutboxWorker(
    db,
    { sendOtp: async () => undefined, sendMessage },
    new ConfigService(),
    notifications,
  );
  try {
    const user = await db.user.create({
      data: { phone: '+989120115001', phoneVerifiedAt: new Date() },
    });
    const order = await seedReferralPurchase(db, user.id);
    const effectiveAt = new Date(Date.now() - 86_400_000);
    const policy = await db.rewardPolicyVersion.create({
      data: {
        requestId: randomUUID(),
        createdById: user.id,
        publishedById: user.id,
        publishedAt: effectiveAt,
        effectiveAt,
        definition: { enabled: true },
      },
    });
    await notifications.updateSettings({
      expectedVersion: 1,
      activationSmsEnabled: true,
      activationIntervalMinutes: 15,
      expiryInAppEnabled: true,
      expiryNoticeDays: 30,
      expiryUrgentDays: 7,
    });
    await notifications.updatePreferences(user.id, {
      activationSmsEnabled: true,
      expiryInAppEnabled: true,
    });
    const expiresAt = new Date(Date.now() + 2 * 86_400_000);
    const grant = await wallet.grant({
      userId: user.id,
      orderId: order.id,
      source: 'PURCHASE',
      sourceKey: order.id,
      policyVersion: policy.version,
      amountToman: 30_000,
      expiresAt,
      idempotencyKey: randomUUID(),
    });
    await expect(
      db.notificationOutboxEvent.count({ where: { type: 'WALLET_CREDIT_ACTIVATED' } }),
    ).resolves.toBe(0);
    const activation = {
      userId: user.id,
      lotId: grant.movements[0].lotId,
      idempotencyKey: randomUUID(),
    };
    await wallet.revokeGrant({
      userId: user.id,
      lotId: activation.lotId,
      amountToman: 5_000,
      idempotencyKey: randomUUID(),
    });
    await wallet.activate(activation);
    await wallet.activate({ ...activation, idempotencyKey: randomUUID() });
    const event = await db.notificationOutboxEvent.findUniqueOrThrow({
      where: { deduplicationKey: `wallet-credit:activated:${activation.lotId}` },
    });
    await db.notificationOutboxEvent.update({
      where: { id: event.id },
      data: { nextAttemptAt: effectiveAt },
    });
    await db.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: null } });
    await worker.dispatchPending();
    await expect(wallet.balance(user.id)).resolves.toMatchObject({ availableToman: 25_000 });
    await expect(
      db.notificationOutboxEvent.findUnique({ where: { id: event.id } }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      attempts: 1,
      lastError: 'WALLET_SMS_PHONE_UNAVAILABLE',
    });
    expect(sendMessage).not.toHaveBeenCalled();
    await db.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
    await db.notificationOutboxEvent.update({
      where: { id: event.id },
      data: { nextAttemptAt: effectiveAt },
    });
    await worker.dispatchPending();
    await expect(
      db.notificationOutboxEvent.findUnique({ where: { id: event.id } }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      attempts: 2,
    });
    await expect(notifications.customer(user.id)).resolves.toMatchObject({
      expiryReminder: { urgent: true, amountToman: 25_000 },
    });
    await db.notificationOutboxEvent.update({
      where: { id: event.id },
      data: { nextAttemptAt: effectiveAt },
    });
    // Move the last dispatch into the past so retry can claim the next interval.
    await db.walletNotificationPreference.update({
      where: { userId: user.id },
      data: { lastDispatchAt: effectiveAt },
    });
    await worker.dispatchPending();
    await worker.dispatchPending();
    await expect(
      db.notificationOutboxEvent.findUnique({ where: { id: event.id } }),
    ).resolves.toMatchObject({
      status: 'SENT',
      attempts: 3,
    });
    expect(sendMessage).toHaveBeenCalledTimes(2);
    const expiryDate = expiresAt.toLocaleDateString('fa-IR', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    expect(sendMessage).toHaveBeenLastCalledWith({
      phone: user.phone,
      text: `گالری حمیدیان\nاعتبار ۲۵٬۰۰۰ تومان فعال شد.\nتاریخ انقضا ${expiryDate}.`,
    });
    const referralCredit = await wallet.grant({
      userId: user.id,
      orderId: order.id,
      source: 'REFERRAL',
      sourceKey: randomUUID(),
      policyVersion: policy.version,
      amountToman: 15_000,
      expiresAt: new Date(Date.now() + 2 * 86_400_000),
      idempotencyKey: randomUUID(),
    });
    await wallet.activate({
      userId: user.id,
      lotId: referralCredit.movements[0].lotId,
      idempotencyKey: randomUUID(),
    });
    const queued = await db.notificationOutboxEvent.update({
      where: { deduplicationKey: `wallet-credit:activated:${referralCredit.movements[0].lotId}` },
      data: { nextAttemptAt: effectiveAt },
    });
    await worker.dispatchPending();
    await expect(
      db.notificationOutboxEvent.findUnique({ where: { id: queued.id } }),
    ).resolves.toMatchObject({
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: expect.any(Date),
    });
    await notifications.updatePreferences(user.id, {
      activationSmsEnabled: false,
      expiryInAppEnabled: false,
    });
    await notifications.updatePreferences(user.id, {
      activationSmsEnabled: true,
      expiryInAppEnabled: false,
    });
    await db.notificationOutboxEvent.update({
      where: { id: queued.id },
      data: { nextAttemptAt: effectiveAt },
    });
    await worker.dispatchPending();
    await expect(
      db.notificationOutboxEvent.findUnique({ where: { id: queued.id } }),
    ).resolves.toMatchObject({
      status: 'SKIPPED',
      lastError: 'WALLET_SMS_DISABLED',
    });
    await expect(notifications.customer(user.id)).resolves.toMatchObject({ expiryReminder: null });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  } finally {
    await close();
  }
}, 120_000);
