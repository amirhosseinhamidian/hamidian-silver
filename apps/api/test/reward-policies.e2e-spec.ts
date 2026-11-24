import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApiRouting } from '../src/app.setup';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import type { RequestWithAuth } from '../src/modules/authorization/authorization.types';
import { PermissionsGuard } from '../src/modules/authorization/permissions.guard';
import { PERMISSION_CODES } from '../src/modules/authorization/rbac.constants';
import type {
  RewardPolicyDefinitionDto,
  RewardPolicyDetailDto,
} from '../src/modules/reward-policies/dto/reward-policy.dto';
import { RewardPoliciesController } from '../src/modules/reward-policies/reward-policies.controller';
import { RewardPoliciesService } from '../src/modules/reward-policies/reward-policies.service';

const eligibility = {
  allowCoupon: true,
  allowedCategoryIds: [],
  excludedCategoryIds: [],
  excludedProductIds: [],
};
const definition: RewardPolicyDefinitionDto = {
  enabled: true,
  expiryDays: 270,
  grantEligibility: eligibility,
  redemptionEligibility: eligibility,
  budget: {
    rewardPerOrderToman: 500_000,
    rewardPerCustomerPeriodToman: 1_000_000,
    rewardPerPeriodToman: 5_000_000,
    incentivesPerOrderToman: 1_000_000,
    incentivesPerCustomerPeriodToman: 3_000_000,
    incentivesPerPeriodToman: 10_000_000,
  },
  grantRules: [
    {
      code: 'second',
      enabled: true,
      priority: 10,
      minimumToman: 3_000_000,
      capToman: 500_000,
      purchaseRank: 'SECOND',
      method: 'PERCENT',
      value: 100,
    },
  ],
  redemptionBands: [],
};

it('authorizes policy publication and previews immutable versions across an effective-time boundary', async () => {
  const db = new PrismaService(new ConfigService());
  const policies = new RewardPoliciesService(db);
  const phone = `+0${BigInt(`0x${randomUUID().replaceAll('-', '').slice(0, 12)}`)}`;
  const actor = await db.user.create({ data: { phone } });
  const fixture = await Test.createTestingModule({
    controllers: [RewardPoliciesController],
    providers: [{ provide: RewardPoliciesService, useValue: policies }],
  }).compile();
  const app = fixture.createNestApplication<INestApplication<App>>();

  try {
    configureApiRouting(app);
    app.use((req: Request & RequestWithAuth, _res: Response, next: NextFunction) => {
      const role = req.header('x-test-role');
      if (role === 'reader' || role === 'writer') {
        req.auth = {
          userId: actor.id,
          phone,
          sessionId: actor.id,
          roleCodes: [],
          permissionCodes:
            role === 'reader'
              ? [PERMISSION_CODES.FINANCE_READ]
              : [PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE],
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
    const root = '/api/v1/reward-policies';
    const draft = { requestId: randomUUID(), definition };
    await api.get(root).expect(401);
    await api.post(root).set('x-test-role', 'reader').send(draft).expect(403);
    await api
      .post(root)
      .set('x-test-role', 'writer')
      .send({
        ...draft,
        definition: { ...definition, grantEligibility: [] },
      })
      .expect(400);
    const created = await api.post(root).set('x-test-role', 'writer').send(draft).expect(201);
    const version = (created.body as RewardPolicyDetailDto).version;
    const replay = await api.post(root).set('x-test-role', 'writer').send(draft).expect(201);
    expect(replay.body).toMatchObject({ version });
    await api
      .post(root)
      .set('x-test-role', 'writer')
      .send({
        ...draft,
        definition: { ...definition, expiryDays: 31 },
      })
      .expect(409);
    await api.post(`${root}/${version}/publish`).set('x-test-role', 'reader').expect(403);

    const input = {
      version,
      lines: [
        {
          productId: randomUUID(),
          categoryIds: [],
          merchandiseToman: 60_000_000,
          directDiscountToman: 0,
          settledCreditToman: 0,
          refundedCashToman: 0,
        },
      ],
      outcome: 'PAID',
      previousCompletedPurchases: 1,
      couponApplied: false,
      shippingDiscountToman: 0,
      otherOrderIncentivesToman: 0,
      availableCreditToman: 0,
      usage: {
        customerRewardsToman: 0,
        periodRewardsToman: 0,
        customerIncentivesToman: 0,
        periodIncentivesToman: 0,
      },
    };
    const preview = await api
      .post(`${root}/simulation`)
      .set('x-test-role', 'reader')
      .send(input)
      .expect(200);
    expect(preview.body).toMatchObject({
      version,
      calculatedRewardToman: 600_000,
      estimatedRewardToman: 500_000,
    });
    await expect(policies.read(version)).resolves.toMatchObject({ publishedAt: null });

    const [firstPublish, retry] = await Promise.all([
      policies.publish(version, actor.id),
      policies.publish(version, actor.id),
    ]);
    expect(retry.publishedAt).toBe(firstPublish.publishedAt);
    expect(firstPublish.publishedById).toBe(actor.id);
    const boundary = new Date(Date.now() + 120_000);
    const disabled = await policies.createDraft(
      {
        requestId: randomUUID(),
        requestedEffectiveAt: boundary.toISOString(),
        definition: { ...definition, enabled: false },
      },
      actor.id,
    );
    await api.post(`${root}/${disabled.version}/publish`).set('x-test-role', 'writer').expect(200);
    await expect(policies.active(new Date(+boundary - 1))).resolves.toMatchObject({
      policy: { version, enabled: true },
    });
    await expect(policies.active(boundary)).resolves.toMatchObject({
      policy: { version: disabled.version, enabled: false },
    });
    await expect(policies.simulate(version, { ...input, outcome: 'PAID' })).resolves.toMatchObject({
      version,
      estimatedRewardToman: 500_000,
    });
    const past = await policies.createDraft(
      {
        requestId: randomUUID(),
        requestedEffectiveAt: '2000-01-01T00:00:00.000Z',
        definition,
      },
      actor.id,
    );
    await expect(policies.publish(past.version, actor.id)).rejects.toThrow(
      'effective time has passed',
    );

    const timingPath = `${root}/activation-timing`;
    const timingInput = {
      requestId: randomUUID(),
      expectedPolicyVersion: version,
      activationDelayDays: 3,
    };
    const initialTiming = await api.get(timingPath).set('x-test-role', 'reader').expect(200);
    expect(initialTiming.body).toMatchObject({ policyVersion: version, activationDelayDays: 7 });
    await api.patch(timingPath).set('x-test-role', 'reader').send(timingInput).expect(403);
    await api
      .patch(timingPath)
      .set('x-test-role', 'writer')
      .send({ ...timingInput, activationDelayDays: -1 })
      .expect(400);
    const delayed = await api
      .patch(timingPath)
      .set('x-test-role', 'writer')
      .send(timingInput)
      .expect(200);
    expect(delayed.body).toMatchObject({ activationDelayDays: 3 });
    expect(delayed.body.policyVersion).not.toBe(version);
    const replayDelay = await api
      .patch(timingPath)
      .set('x-test-role', 'writer')
      .send(timingInput)
      .expect(200);
    expect(replayDelay.body).toEqual(delayed.body);
    await api
      .patch(timingPath)
      .set('x-test-role', 'writer')
      .send({ ...timingInput, requestId: randomUUID(), activationDelayDays: 0 })
      .expect(409);
    const immediate = await api
      .patch(timingPath)
      .set('x-test-role', 'writer')
      .send({
        requestId: randomUUID(),
        expectedPolicyVersion: delayed.body.policyVersion,
        activationDelayDays: 0,
      })
      .expect(200);
    expect(immediate.body).toMatchObject({ activationDelayDays: 0 });
    await expect(policies.read(immediate.body.policyVersion)).resolves.toMatchObject({
      definition: { ...definition, activationDelayDays: 0 },
    });
    await expect(policies.read(version)).resolves.toMatchObject({ definition });
  } finally {
    try {
      await app.close();
      await db.$transaction([
        db.rewardPolicyVersion.deleteMany({ where: { createdById: actor.id } }),
        db.user.delete({ where: { id: actor.id } }),
      ]);
    } finally {
      await db.$disconnect();
    }
  }
}, 30_000);
