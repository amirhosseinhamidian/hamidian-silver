import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApiRouting } from '../src/app.setup';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import type { RequestWithAuth } from '../src/modules/authorization/authorization.types';
import { PermissionsGuard } from '../src/modules/authorization/permissions.guard';
import { PERMISSION_CODES } from '../src/modules/authorization/rbac.constants';
import type { RewardPolicyDefinitionDto } from '../src/modules/reward-policies/dto/reward-policy.dto';
import { PolicySimulationController } from '../src/modules/reward-policies/policy-simulation.controller';
import { PolicySimulationService } from '../src/modules/reward-policies/policy-simulation.service';
import { RewardPoliciesService } from '../src/modules/reward-policies/reward-policies.service';
import { GrowthCreditIssuanceController } from '../src/modules/wallet/growth-credit-issuance.controller';
import { GrowthCreditIssuanceService } from '../src/modules/wallet/growth-credit-issuance.service';
import { createIsolatedTestDatabase } from './support/isolated-test-database';

const usage = {
  customerRewardsToman: 0,
  periodRewardsToman: 0,
  customerIncentivesToman: 0,
  periodIncentivesToman: 0,
};
const eligibility = {
  allowCoupon: false,
  allowedCategoryIds: [],
  excludedCategoryIds: [],
  excludedProductIds: [],
};
const band = { enabled: true, minimumToman: 1, capToman: 30_000, priority: 1 };
const definition = {
  enabled: true,
  expiryDays: 30,
  activationDelayDays: 0,
  grantEligibility: eligibility,
  redemptionEligibility: eligibility,
  budget: {
    rewardPerOrderToman: 30_000,
    rewardPerCustomerPeriodToman: 100_000,
    rewardPerPeriodToman: 150_000,
    incentivesPerOrderToman: 300_000,
    incentivesPerCustomerPeriodToman: 500_000,
    incentivesPerPeriodToman: 600_000,
  },
  grantRules: [{ ...band, code: 'all', purchaseRank: 'ANY', method: 'PERCENT', value: 1000 }],
  redemptionBands: [{ ...band, code: 'available', rateBps: 1000 }],
} satisfies RewardPolicyDefinitionDto;

it('quotes current prices, checks quota and caps, saves only an authorized decision and replays anonymous history', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  let app: INestApplication<App> | undefined;
  try {
    const actor = await db.user.create({ data: { phone: '+01000000001' } });
    const fixture = await Test.createTestingModule({
      controllers: [PolicySimulationController, GrowthCreditIssuanceController],
      providers: [
        PolicySimulationService,
        RewardPoliciesService,
        GrowthCreditIssuanceService,
        { provide: ConfigService, useValue: new ConfigService() },
        { provide: PrismaService, useValue: db },
      ],
    }).compile();
    app = fixture.createNestApplication<INestApplication<App>>();
    configureApiRouting(app);
    app.use((req: Request & RequestWithAuth, _res: Response, next: NextFunction) => {
      const role = req.header('x-test-role');
      if (role === 'reader' || role === 'writer') {
        req.auth = {
          userId: actor.id,
          phone: actor.phone,
          sessionId: actor.id,
          roleCodes: [],
          permissionCodes:
            role === 'writer'
              ? [PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE]
              : [PERMISSION_CODES.FINANCE_READ],
        };
      }
      next();
    });
    app.useGlobalGuards(new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    const api = request(app.getHttpServer());
    const root = '/api/v1/reward-policies/policy-simulator';
    const issuancePath = '/api/v1/wallet/admin/credit-issuance';
    await api.get(issuancePath).expect(401);
    const control = await api.get(issuancePath).set('x-test-role', 'reader').expect(200);
    expect(control.body).toMatchObject({ mode: 'LIVE', version: 1 });
    const transition = { mode: 'SHADOW', expectedVersion: 1 };
    await api.patch(issuancePath).set('x-test-role', 'reader').send(transition).expect(403);
    const shadow = await api
      .patch(issuancePath)
      .set('x-test-role', 'writer')
      .send(transition)
      .expect(200);
    expect(shadow.body).toMatchObject({ mode: 'SHADOW', version: 2 });
    await api.patch(issuancePath).set('x-test-role', 'writer').send(transition).expect(409);

    const policy = await db.rewardPolicyVersion.create({
      data: { requestId: randomUUID(), createdById: actor.id, definition },
    });
    const product = await db.product.create({
      data: {
        name: 'Ring',
        slug: 'sample-ring',
        status: 'ACTIVE',
        salePriceToman: 100_000,
        variants: { create: { sku: 'SAMPLE-01', salePriceToman: 120_000 } },
      },
      include: { variants: true },
    });
    const variant = product.variants[0];
    const at = new Date('2026-11-27T13:00:00Z');
    await db.campaignLinkIdentity.create({ data: { id: 'simulation', campaign: 'simulation' } });
    const campaign = await db.campaign.create({
      data: {
        name: 'Sample discount',
        slug: 'simulation',
        trackingId: 'simulation',
        ownerId: actor.id,
        goal: 'Simulation',
        message: 'Simulation',
        channel: 'email',
        allProducts: true,
        startsAt: new Date('2026-11-27T11:00:00Z'),
        endsAt: new Date('2026-11-27T15:00:00Z'),
        status: 'ACTIVE',
        budgetToman: 500_000,
      },
    });
    await db.campaignPromotion.create({
      data: {
        campaignId: campaign.id,
        actorUserId: actor.id,
        kind: 'PERCENT',
        value: 1000,
        minSubtotalToman: 0,
        maxDiscountToman: 300_000,
        maxDiscountBps: 5000,
        priority: 0,
        percentageOverrides: [{ productId: product.id, variantId: variant.id, rateBps: 2000 }],
      },
    });
    await db.campaignQuota.create({
      data: { campaignId: campaign.id, productId: product.id, limit: 1 },
    });
    const basket = {
      version: policy.version,
      items: [{ productSlug: product.slug, variantSku: variant.sku, quantity: 1 }],
      occurredAt: at.toISOString(),
      outcome: 'PAID',
      previousCompletedPurchases: 0,
      shippingToman: 0,
      availableCreditToman: 10_000,
      couponApplied: false,
      usage,
      campaignId: campaign.id,
    };
    await api
      .post(root + '/basket')
      .send(basket)
      .expect(401);
    const preview = await api
      .post(root + '/basket')
      .set('x-test-role', 'reader')
      .send(basket)
      .expect(200);
    expect(preview.body).toMatchObject({
      items: [
        { defaultPriceToman: 100_000, unitPriceToman: 120_000, merchandiseDiscountToman: 24_000 },
      ],
      walletToman: 9_600,
      payableToman: 86_400,
      reward: { purchaseRank: 'FIRST', estimatedRewardToman: 8_640 },
      reviewId: null,
    });
    expect(await db.policySimulationReview.count()).toBe(0);
    const exhausted = await api
      .post(root + '/basket')
      .set('x-test-role', 'reader')
      .send({
        ...basket,
        previousCompletedPurchases: 2,
        items: [{ productSlug: product.slug, quantity: 2 }],
        usage: {
          ...usage,
          customerRewardsToman: 100_000,
          periodRewardsToman: 100_000,
          customerIncentivesToman: 100_000,
          periodIncentivesToman: 100_000,
        },
      })
      .expect(200);
    expect(exhausted.body).toMatchObject({
      merchandiseToman: 200_000,
      merchandiseDiscountToman: 0,
      reward: { purchaseRank: 'THIRD_OR_LATER', estimatedRewardToman: 0 },
      warnings: expect.arrayContaining(['CAMPAIGN_QUOTA_EXHAUSTED', 'PURCHASE_REWARD_LIMIT']),
    });
    const referralPolicy = await db.referralRewardPolicyVersion.create({
      data: {
        requestId: randomUUID(),
        createdById: actor.id,
        definition: {
          enabled: true,
          periodBudgetToman: 100_000,
          rules: (['REFERRED', 'REFERRER'] as const).map((recipient) => ({
            code: recipient.toLowerCase(),
            recipient,
            ...band,
            purchaseRank: 'FIRST',
            method: 'FIXED',
            value: 5_000,
            expiryDays: recipient === 'REFERRED' ? 10 : 30,
            maxUsesPerRecipient: 1,
            periodBudgetToman: 50_000,
            campaignIds: [],
            allowedCategoryIds: [],
            allowCampaign: true,
            allowCoupon: false,
            allowPurchaseReward: recipient === 'REFERRER',
          })),
        },
      },
    });
    const referral = {
      version: referralPolicy.version,
      referrerHasPurchased: true,
      delivered: true,
      returnPending: false,
      referrerIncentivesToman: 0,
      claimAgeDays: 1,
      programCommittedToman: 0,
      usage: [],
      metrics: [],
    };
    const combined = await api
      .post(root + '/basket')
      .set('x-test-role', 'reader')
      .send({ ...basket, referral })
      .expect(200);
    expect(combined.body).toMatchObject({
      referralDiscountToman: 5_000,
      walletToman: 9_100,
      reward: { estimatedRewardToman: 0 },
      referral: {
        recipients: [
          { recipient: 'REFERRED', amountToman: 5_000, expiryDays: 10 },
          { recipient: 'REFERRER', amountToman: 5_000, expiryDays: 30 },
        ],
      },
      warnings: expect.arrayContaining(['PURCHASE_REWARD_REFERRAL_EXCLUDED']),
    });
    const ineligible = await api
      .post(root + '/basket')
      .set('x-test-role', 'reader')
      .send({
        ...basket,
        referral: { ...referral, referrerHasPurchased: false },
      })
      .expect(200);
    expect(ineligible.body).toMatchObject({
      referralDiscountToman: 0,
      referral: { totalToman: 0 },
      warnings: expect.arrayContaining(['REFERRAL_NOT_ELIGIBLE']),
    });
    const risky = await api
      .post(root + '/basket')
      .set('x-test-role', 'reader')
      .send({
        ...basket,
        referral: {
          ...referral,
          metrics: [
            { code: 'SHARED_DEVICE', value: 1 },
            { code: 'VERIFIED_PAYMENT_REUSE', value: 1 },
          ],
        },
      })
      .expect(200);
    expect(risky.body).toMatchObject({
      referralDiscountToman: 5_000,
      risk: { action: 'REJECT' },
      referral: {
        recipients: expect.arrayContaining([
          expect.objectContaining({ recipient: 'REFERRER', amountToman: 0 }),
        ]),
      },
    });
    const review = { requestId: randomUUID(), decision: 'HOLD' };
    await api
      .post(root + '/basket')
      .set('x-test-role', 'reader')
      .send({ ...basket, review })
      .expect(403);
    const save = () =>
      api
        .post(root + '/basket')
        .set('x-test-role', 'writer')
        .send({ ...basket, review })
        .expect(200);
    const [first, retry] = await Promise.all([save(), save()]);
    expect(first.body).toEqual(retry.body);
    expect(first.body.reviewId).toBe(review.requestId);
    await api
      .post(root + '/basket')
      .set('x-test-role', 'writer')
      .send({
        ...basket,
        review: { ...review, decision: 'REJECT' },
      })
      .expect(409);
    const reviews = await api
      .get(root + '/reviews')
      .set('x-test-role', 'reader')
      .expect(200);
    expect(reviews.body.items).toEqual([
      expect.objectContaining({
        id: review.requestId,
        decision: 'HOLD',
        input: expect.objectContaining({ version: policy.version }),
        result: expect.objectContaining({ payableToman: 86_400 }),
      }),
    ]);
    expect(await db.order.count()).toBe(0);
    expect(await db.walletLot.count()).toBe(0);
    expect(await db.walletReservation.count()).toBe(0);
    expect(await db.campaignQuotaAllocation.count()).toBe(0);
    expect(
      (await db.rewardPolicyVersion.findUniqueOrThrow({ where: { version: policy.version } }))
        .publishedAt,
    ).toBeNull();

    const warehouse = await db.warehouse.create({ data: { code: 'simulation', name: 'Test' } });
    const basis = {
      couponApplied: false,
      shippingDiscountToman: 0,
      items: [
        {
          variantId: variant.id,
          platingType: null,
          productId: product.id,
          categoryIds: [],
          directDiscountToman: 0,
        },
      ],
    };
    const order = await db.order.create({
      data: {
        orderNumber: 'simulation-order',
        userId: actor.id,
        warehouseId: warehouse.id,
        status: 'PAID',
        merchandiseTotalToman: 120_000,
        grandTotalToman: 120_000,
        paidAt: at,
        createdAt: at,
        reservationExpiresAt: at,
        purchaseRewardBasis: basis,
        payment: { create: { status: 'PAID', amountToman: 120_000, paidAt: at, createdAt: at } },
        items: {
          create: {
            variantId: variant.id,
            quantity: 1,
            productNameSnapshot: product.name,
            skuSnapshot: variant.sku,
            unitSalePriceToman: 120_000,
            lineTotalToman: 120_000,
          },
        },
      },
    });
    await db.purchaseRewardJob.create({
      data: {
        orderId: order.id,
        userId: actor.id,
        paidAt: at,
        status: 'COMPLETED',
        nextAttemptAt: at,
        policyVersion: policy.version,
        calculation: {
          basis,
          usage,
          otherOrderIncentivesToman: 0,
          previousCompletedPurchases: 0,
          ruleCode: 'all',
          baseToman: 120_000,
          grantedToman: 8_000,
          activationDelayDays: 0,
        },
      },
    });
    const input = { version: policy.version, from: '2026-11-27', to: '2026-11-27' };
    const history = () =>
      api
        .post(root + '/history')
        .set('x-test-role', 'reader')
        .send(input)
        .expect(200);
    const historic = await history();
    expect(historic.body).toMatchObject({
      scannedOrders: 1,
      evaluatedOrders: 1,
      withoutEvidence: 0,
      truncated: false,
      recordedRewardToman: 8_000,
      estimatedRewardToman: 12_000,
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(historic.body)).not.toContain(order.id);
    expect((await history()).body).toEqual(historic.body);
    expect(await db.walletLot.count()).toBe(0);
    await db.purchaseRewardJob.update({
      where: { orderId: order.id },
      data: { status: 'PENDING', calculation: Prisma.DbNull, policyVersion: null },
    });
    const queued = await api
      .post(root + '/history')
      .set('x-test-role', 'reader')
      .send({ ...input, pendingOnly: true })
      .expect(200);
    expect(queued.body).toMatchObject({
      pendingOnly: true,
      scannedOrders: 1,
      evaluatedOrders: 1,
      estimatedRewardToman: 12_000,
    });
    expect(JSON.stringify(queued.body)).not.toContain(order.id);
    await expect(
      db.purchaseRewardJob.findUnique({ where: { orderId: order.id } }),
    ).resolves.toMatchObject({
      status: 'PENDING',
      attempts: 0,
      calculation: null,
      policyVersion: null,
    });
    await expect(db.walletLot.count()).resolves.toBe(0);
  } finally {
    await app?.close();
    await close();
  }
}, 120_000);
