import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { OrderFinanceService } from '../src/modules/finance/order-finance.service';
import { PaymentRefundsService } from '../src/modules/finance/payment-refunds.service';
import type { CreateOrderDto } from '../src/modules/orders/dto/create-order.dto';
import { OrderReturnsService } from '../src/modules/orders/order-returns.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import type { PaymentGateway } from '../src/modules/payments/payment-gateway.port';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { RewardPoliciesService } from '../src/modules/reward-policies/reward-policies.service';
import { GrowthCreditIssuanceService } from '../src/modules/wallet/growth-credit-issuance.service';
import { PurchaseRewardWorker } from '../src/modules/wallet/purchase-reward.worker';
import { WalletCheckoutService } from '../src/modules/wallet/wallet-checkout.service';
import { WalletLedgerService } from '../src/modules/wallet/wallet-ledger.service';
import { createIsolatedTestDatabase } from './support/isolated-test-database';

const minute = 60_000;
const day = 24 * 60 * minute;
it('keeps payments committed across worker failure and issues and activates each valid reward once', async () => {
  const config = new ConfigService({
    SHIPPING_PROVIDER: 'disabled',
    MANUAL_SHIPPING_COST_TOMAN: 0,
  });
  const { db, close } = await createIsolatedTestDatabase();
  const policies = new RewardPoliciesService(db);
  const issuance = new GrowthCreditIssuanceService(db, config);
  const ledger = new WalletLedgerService(db);
  const checkout = new WalletCheckoutService(policies, ledger);
  const worker = new PurchaseRewardWorker(db, policies, ledger, checkout, config);
  const gateway: PaymentGateway = {
    providerCode: 'test',
    async initiate({ attemptId }) {
      return { authority: attemptId, paymentUrl: 'https://payments.example.test/pay' };
    },
    async verify({ authority }) {
      return { success: true, referenceId: authority };
    },
  };
  const payments = new PaymentsService(db, config, gateway, undefined, new OrderFinanceService(db));
  const orders = new OrdersService(db, undefined, config);
  const returns = new OrderReturnsService(db, checkout);
  const refunds = new PaymentRefundsService(db, checkout);
  const key = randomUUID();
  const phoneSuffix = BigInt(`0x${key.replaceAll('-', '').slice(0, 12)}`).toString();

  try {
    const buyer = await db.user.create({ data: { phone: `+0${phoneSuffix}` } });
    const warehouse =
      (await db.warehouse.findFirst({
        where: { isDefault: true, isActive: true, deletedAt: null },
      })) ??
      (await db.warehouse.create({
        data: { code: key, name: 'Purchase reward test', isDefault: true },
      }));
    const product = await db.product.create({
      data: {
        slug: `reward-${key}`,
        name: 'کالای آزمایشی',
        status: 'ACTIVE',
        salePriceToman: 15_000,
        variants: { create: [{ sku: key }, { sku: `${key}-second` }] },
      },
      include: { variants: true },
    });
    await db.inventory.createMany({
      data: product.variants.map(({ id }) => ({
        warehouseId: warehouse.id,
        variantId: id,
        onHand: 10,
      })),
    });
    const effectiveAt = new Date();
    const eligibility = {
      allowCoupon: false,
      allowedCategoryIds: [],
      excludedCategoryIds: [],
      excludedProductIds: [],
    };
    const policy = await db.rewardPolicyVersion.create({
      data: {
        requestId: randomUUID(),
        createdById: buyer.id,
        effectiveAt,
        publishedAt: effectiveAt,
        publishedById: buyer.id,
        definition: {
          enabled: true,
          expiryDays: 30,
          redemptionBands: [],
          grantEligibility: eligibility,
          redemptionEligibility: eligibility,
          grantRules: [
            {
              code: 'first',
              enabled: true,
              priority: 1,
              minimumToman: 1,
              capToman: 10_000,
              purchaseRank: 'FIRST',
              method: 'PERCENT',
              value: 1_000,
            },
            {
              code: 'second',
              enabled: true,
              priority: 1,
              minimumToman: 1,
              capToman: 10_000,
              purchaseRank: 'SECOND',
              method: 'FIXED',
              value: 9_000,
            },
          ],
          budget: {
            rewardPerOrderToman: 9_000,
            rewardPerCustomerPeriodToman: 7_000,
            rewardPerPeriodToman: 7_000,
            incentivesPerOrderToman: 9_000,
            incentivesPerCustomerPeriodToman: 7_000,
            incentivesPerPeriodToman: 7_000,
          },
        },
      },
    });

    const body: CreateOrderDto = {
      items: [{ variantId: product.variants[0].id, quantity: 2 }],
      shippingAddress: {
        recipientName: 'خریدار آزمایش',
        phone: '09121234567',
        province: 'تهران',
        city: 'تهران',
        addressLine: 'نشانی ساختگی برای آزمون',
        postalCode: '1234567890',
      },
    };
    const register = (variantId = product.variants[0].id) =>
      orders.createOrder(buyer.id, { ...body, items: [{ variantId, quantity: 2 }] });
    async function pay(orderId: string) {
      const attempt = await payments.initiateOrderPayment(buyer.id, orderId, {
        idempotencyKey: randomUUID(),
      });
      await payments.verifyCallback(attempt.attemptId, attempt.authority!);
      await expect(
        payments.verifyCallback(attempt.attemptId, attempt.authority!),
      ).resolves.toMatchObject({ alreadyVerified: true });
    }
    const original = await issuance.status();
    const shadow = await issuance.setMode('SHADOW', original.version);
    await expect(issuance.setMode('LIVE', original.version)).rejects.toMatchObject({ status: 409 });
    const initial = [await register(), await register(product.variants[1].id)];
    await Promise.all(initial.map(({ id }) => pay(id)));
    await worker.tick();
    const jobs = await db.purchaseRewardJob.findMany({
      where: { userId: buyer.id },
      orderBy: { sequence: 'asc' },
    });
    expect(jobs.map(({ status }) => status)).toEqual(['PENDING', 'PENDING']);
    await expect(
      db.payment.count({ where: { orderId: { in: initial.map(({ id }) => id) }, status: 'PAID' } }),
    ).resolves.toBe(2);
    await expect(worker.run()).resolves.toMatchObject({ claimed: 0 });
    await expect(db.walletLot.count({ where: { userId: buyer.id } })).resolves.toBe(0);
    expect(jobs.map(({ attempts }) => attempts)).toEqual([0, 0]);
    const live = await issuance.setMode('LIVE', shadow.version);

    const failedAt = new Date();
    await worker.setReviewHold(jobs[0].orderId, true, failedAt);
    await expect(worker.run(failedAt)).resolves.toMatchObject({ claimed: 0 });
    await expect(worker.forCustomer(buyer.id, 1)).resolves.toMatchObject({
      items: [
        expect.objectContaining({ orderId: jobs[0].orderId, reviewHeldAt: failedAt.toISOString() }),
        expect.any(Object),
      ],
    });
    await expect(worker.setReviewHold(jobs[0].orderId, true)).rejects.toThrow();
    await worker.setReviewHold(jobs[0].orderId, false);
    jest.spyOn(policies, 'active').mockRejectedValueOnce(new Error('simulated worker failure'));
    await expect(worker.run(failedAt)).resolves.toMatchObject({ claimed: 1, retry: 1 });
    await expect(db.walletLot.count({ where: { userId: buyer.id } })).resolves.toBe(0);
    await expect(
      db.purchaseRewardJob.findUnique({ where: { orderId: jobs[0].orderId } }),
    ).resolves.toMatchObject({ status: 'PENDING', attempts: 1, resultCode: 'PROCESSING_FAILED' });

    // On restart, the first job still owns priority for the customer's capped monthly budget.
    const restarted = new PurchaseRewardWorker(
      db,
      new RewardPoliciesService(db),
      ledger,
      checkout,
      config,
    );
    const restartedAt = new Date(+failedAt + 2 * minute);
    await Promise.all([restarted.run(restartedAt), worker.run(restartedAt)]);
    const issued = await db.purchaseRewardJob.findMany({
      where: { userId: buyer.id },
      orderBy: { sequence: 'asc' },
    });
    expect(issued).toMatchObject([
      {
        status: 'WAITING',
        policyVersion: policy.version,
        calculation: { ruleCode: 'first', grantedToman: 3_000, activationDelayDays: 7 },
      },
      {
        status: 'WAITING',
        policyVersion: policy.version,
        calculation: { ruleCode: 'second', grantedToman: 4_000 },
      },
    ]);
    await expect(ledger.balance(buyer.id)).resolves.toMatchObject({
      availableToman: 0,
      pendingToman: 7_000,
    });

    const deliveredAt = new Date(+restartedAt + minute);
    const first = await db.order.update({
      where: { id: jobs[0].orderId },
      data: { status: 'DELIVERED', deliveredAt },
      include: { items: true },
    });
    const pendingReturn = await returns.create(first.id, buyer.id, {
      reason: 'Partial return',
      items: [{ orderItemId: first.items[0].id, quantity: 1 }],
    });
    const cashRefund = await refunds.create(buyer.id, {
      orderId: jobs[1].orderId,
      amountToman: 30_000,
      idempotencyKey: randomUUID(),
    });
    await refunds.confirm(cashRefund.id, buyer.id, { externalReference: randomUUID() });
    await restarted.run(new Date(+deliveredAt + 7 * day));
    await expect(ledger.balance(buyer.id)).resolves.toMatchObject({
      availableToman: 0,
      pendingToman: 3_000,
    });

    await returns.receive(pendingReturn.id, buyer.id, {
      items: [{ returnItemId: pendingReturn.items[0].id, disposition: 'RESTOCK' }],
    });
    const dueAt = new Date(+deliveredAt + 7 * day + 60 * minute);
    const paused = await issuance.setMode('PAUSED', live.version);
    await Promise.all([restarted.run(dueAt), worker.run(dueAt)]);
    await expect(ledger.balance(buyer.id)).resolves.toMatchObject({
      availableToman: 1_500,
      pendingToman: 0,
    });
    await expect(
      db.walletOperation.count({ where: { userId: buyer.id, kind: 'ACTIVATE' } }),
    ).resolves.toBe(1);
    await expect(
      db.walletLot.count({ where: { userId: buyer.id, source: 'PURCHASE' } }),
    ).resolves.toBe(2);
    await issuance.setMode('LIVE', paused.version);

    const third = await register();
    await pay(third.id);
    await db.purchaseRewardJob.update({
      where: { orderId: third.id },
      data: {
        status: 'PROCESSING',
        attempts: 8,
        leaseToken: randomUUID(),
        leaseUntil: new Date(+dueAt - 1),
      },
    });
    await expect(restarted.run(dueAt)).resolves.toMatchObject({ deadLetter: 1 });
    await expect(restarted.metrics(dueAt)).resolves.toMatchObject({
      enabled: false,
      deadLetters: expect.arrayContaining([
        { orderId: third.id, attempts: 8, resultCode: 'LEASE_EXHAUSTED' },
      ]),
    });
    await restarted.retryDeadLetter(third.id, dueAt);
    await restarted.run(dueAt);
    await expect(
      db.purchaseRewardJob.findUnique({ where: { orderId: third.id } }),
    ).resolves.toMatchObject({ status: 'SKIPPED' });

    const { definition: previousDefinition } = await policies.read(policy.version);
    const nextPolicy = await policies.createDraft(
      {
        requestId: randomUUID(),
        definition: {
          ...previousDefinition,
          grantRules: [
            {
              code: 'instant',
              enabled: true,
              priority: 1,
              minimumToman: 1,
              capToman: 2_000,
              purchaseRank: 'ANY',
              method: 'FIXED',
              value: 2_000,
            },
          ],
          budget: {
            ...previousDefinition.budget,
            rewardPerCustomerPeriodToman: 20_000,
            rewardPerPeriodToman: 20_000,
            incentivesPerCustomerPeriodToman: 20_000,
            incentivesPerPeriodToman: 20_000,
          },
        },
      },
      buyer.id,
    );
    await policies.publish(nextPolicy.version, buyer.id);
    const immediateTiming = await policies.updateActivationTiming(
      {
        requestId: randomUUID(),
        expectedPolicyVersion: nextPolicy.version,
        activationDelayDays: 0,
      },
      buyer.id,
    );

    const immediateOrder = await register();
    await pay(immediateOrder.id);
    const issuedAt = new Date();
    await restarted.run(issuedAt);
    await expect(
      db.purchaseRewardJob.findUnique({ where: { orderId: immediateOrder.id } }),
    ).resolves.toMatchObject({
      status: 'WAITING',
      policyVersion: immediateTiming.policyVersion,
      calculation: { activationDelayDays: 0, grantedToman: 2_000 },
    });
    await expect(ledger.balance(buyer.id)).resolves.toMatchObject({
      availableToman: 1_500,
      pendingToman: 2_000,
    });

    const immediateDeliveryAt = new Date(+issuedAt + minute);
    await db.order.update({
      where: { id: immediateOrder.id },
      data: { status: 'DELIVERED', deliveredAt: immediateDeliveryAt },
    });
    await expect(
      db.purchaseRewardJob.findUnique({ where: { orderId: immediateOrder.id } }),
    ).resolves.toMatchObject({ nextAttemptAt: immediateDeliveryAt });
    await restarted.run(immediateDeliveryAt);
    await expect(ledger.balance(buyer.id)).resolves.toMatchObject({
      availableToman: 3_500,
      pendingToman: 0,
    });
  } finally {
    await close();
  }
}, 120_000);
