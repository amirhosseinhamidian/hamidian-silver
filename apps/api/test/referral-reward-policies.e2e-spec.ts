import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApiRouting } from '../src/app.setup';
import type { RequestWithAuth } from '../src/modules/authorization/authorization.types';
import { PermissionsGuard } from '../src/modules/authorization/permissions.guard';
import { PERMISSION_CODES } from '../src/modules/authorization/rbac.constants';
import type { ReferralRewardDefinitionDto } from '../src/modules/referrals/dto/referral-reward-policy.dto';
import { ReferralRewardPoliciesController } from '../src/modules/referrals/referral-reward-policies.controller';
import { ReferralRewardPoliciesService } from '../src/modules/referrals/referral-reward-policies.service';
import { ReferralsService } from '../src/modules/referrals/referrals.service';
import { createIsolatedTestDatabase } from './support/isolated-test-database';
import { seedReferralPurchase } from './support/referral-purchase';

it('simulates without writes, restricts publication, and preserves previously attributed versions', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const policies = new ReferralRewardPoliciesService(db);
  const referrals = new ReferralsService(db, new ConfigService({ REFERRALS_ENABLED: true }));
  let app: INestApplication<App> | undefined;
  try {
    const [actor, referrer, first, second, legacy] = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        db.user.create({ data: { phone: `+98912010030${i}`, phoneVerifiedAt: new Date() } }),
      ),
    );
    const category = await db.category.create({
      data: { name: 'Silver RF02', slug: 'silver-rf02' },
    });
    const definition: ReferralRewardDefinitionDto = {
      enabled: true,
      periodBudgetToman: 10_000,
      rules: [
        {
          code: 'first',
          recipient: 'REFERRER',
          enabled: true,
          priority: 10,
          purchaseRank: 'FIRST',
          method: 'FIXED',
          value: 2500,
          minimumToman: 10_000,
          maximumExclusiveToman: null,
          capToman: 2500,
          expiryDays: 90,
          campaignIds: [],
          allowedCategoryIds: [category.id],
          allowCampaign: false,
          allowCoupon: false,
          allowPurchaseReward: false,
          maxUsesPerRecipient: 1,
          periodBudgetToman: 10_000,
        },
      ],
    };
    await seedReferralPurchase(db, referrer.id);
    const { code } = await referrals.issueCode(referrer.id);
    await referrals.claim(legacy.id, code);
    const module = await Test.createTestingModule({
      controllers: [ReferralRewardPoliciesController],
      providers: [{ provide: ReferralRewardPoliciesService, useValue: policies }],
    }).compile();
    app = module.createNestApplication<INestApplication<App>>();
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
    const root = '/api/v1/referral-reward-policies';
    const draft = { requestId: randomUUID(), definition };
    await api.get(root).expect(401);
    await api.post(root).set('x-test-role', 'reader').send(draft).expect(403);
    await api
      .get(`${root}/scopes?kind=category&q=silver-rf02`)
      .set('x-test-role', 'reader')
      .expect(200)
      .expect([{ id: category.id, name: category.name }]);
    await api
      .post(`${root}/simulation`)
      .set('x-test-role', 'reader')
      .send({
        definition,
        sample: {
          occurredAt: new Date().toISOString(),
          purchaseRank: 1,
          confirmed: true,
          couponApplied: false,
          purchaseRewardApplied: false,
          campaignId: null,
          lines: [{ eligibleToman: 30_000, categoryIds: [category.id] }],
          usage: [],
          remainingIncentiveToman: 2000,
          programCommittedToman: 0,
        },
      })
      .expect(200)
      .expect((result) => {
        expect(result.body).toMatchObject({ totalToman: 2000 });
      });
    await expect(db.referralRewardPolicyVersion.count()).resolves.toBe(0);
    await expect(db.walletLot.count()).resolves.toBe(0);

    const created = await api.post(root).set('x-test-role', 'writer').send(draft).expect(201);
    const version = Number(created.body.version);
    const replayed = await api.post(root).set('x-test-role', 'writer').send(draft).expect(201);
    expect(replayed.body.version).toBe(version);
    await api.post(`${root}/${version}/publish`).set('x-test-role', 'reader').expect(403);
    await api.post(`${root}/${version}/publish`).set('x-test-role', 'writer').expect(200);
    await referrals.claim(first.id, code);
    const updated = await api
      .post(root)
      .set('x-test-role', 'writer')
      .send({
        requestId: randomUUID(),
        definition: { ...definition, enabled: false },
      })
      .expect(201);
    const disablingVersion = Number(updated.body.version);
    await api.post(`${root}/${disablingVersion}/publish`).set('x-test-role', 'writer').expect(200);
    await referrals.claim(second.id, code);
    await expect(policies.list(1)).resolves.toMatchObject({
      active: { version: disablingVersion, enabled: false },
    });
    const snapshots = await db.referralAttribution.findMany({
      select: { referredUserId: true, rewardPolicyVersion: true },
    });
    expect(snapshots).toEqual(
      expect.arrayContaining([
        { referredUserId: legacy.id, rewardPolicyVersion: null },
        { referredUserId: first.id, rewardPolicyVersion: version },
        { referredUserId: second.id, rewardPolicyVersion: disablingVersion },
      ]),
    );
    await expect(
      db.referralAttribution.update({
        where: { referredUserId: first.id },
        data: { rewardPolicyVersion: disablingVersion },
      }),
    ).rejects.toThrow('snapshots cannot change');
    await expect(
      db.referralRewardPolicyVersion.update({
        where: { version },
        data: { definition: { enabled: false } },
      }),
    ).rejects.toThrow('versions are immutable');
    const scheduled = await api
      .post(root)
      .set('x-test-role', 'writer')
      .send({
        requestId: randomUUID(),
        definition,
        requestedEffectiveAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(201);
    await api
      .post(`${root}/${scheduled.body.version}/publish`)
      .set('x-test-role', 'writer')
      .expect(200);
    await expect(policies.list(1)).resolves.toMatchObject({
      active: { version: disablingVersion },
    });
  } finally {
    try {
      await app?.close();
    } finally {
      await close();
    }
  }
}, 120_000);
