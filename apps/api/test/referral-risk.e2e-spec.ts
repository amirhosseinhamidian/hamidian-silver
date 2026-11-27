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
import { PERMISSION_CODES, type PermissionCode } from '../src/modules/authorization/rbac.constants';
import { ReferralRiskController } from '../src/modules/referrals/referral-risk.controller';
import { defaultReferralRiskPolicy } from '../src/modules/referrals/referral-risk-engine';
import { ReferralRiskEvidenceService } from '../src/modules/referrals/referral-risk-evidence.service';
import { ReferralRiskObservationsService } from '../src/modules/referrals/referral-risk-observations.service';
import { ReferralRiskPoliciesService } from '../src/modules/referrals/referral-risk-policies.service';
import { ReferralRiskService } from '../src/modules/referrals/referral-risk.service';
import { ReferralsService } from '../src/modules/referrals/referrals.service';
import { ReferralsController } from '../src/modules/referrals/referrals.controller';
import { createIsolatedTestDatabase } from './support/isolated-test-database';
import { seedReferralPurchase } from './support/referral-purchase';

const day = 86_400_000;

it('isolates shared-network matches, records concurrent cases once and enforces review permissions', async () => {
  const { db, close } = await createIsolatedTestDatabase();
  const policies = new ReferralRiskPoliciesService(db);
  const referrals = new ReferralsService(db, new ConfigService({ REFERRALS_ENABLED: true }));
  const risk = new ReferralRiskService(db, policies, new ReferralRiskEvidenceService(db));
  let app: INestApplication<App> | undefined;
  try {
    const [actor, referrer, first, second] = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        db.user.create({
          data: { phone: `+98912011010${index}`, phoneVerifiedAt: new Date() },
        }),
      ),
    );
    const before = new Date(Date.now() - day);
    await db.referralRewardPolicyVersion.create({
      data: {
        requestId: randomUUID(),
        definition: { enabled: true },
        createdById: actor.id,
        publishedAt: before,
        publishedById: actor.id,
        effectiveAt: before,
      },
    });
    const policy = defaultReferralRiskPolicy();
    policy.minSignals = 1;
    policy.retentionDays = 1;
    policy.signals.forEach((signal) => {
      signal.enabled = signal.code === 'SHARED_NETWORK' || signal.code === 'SHARED_DEVICE';
      signal.weight = 100;
    });
    const draft = { requestId: randomUUID(), expectedVersion: null, definition: policy };
    const published = await policies.publish(draft, actor.id);
    await expect(policies.publish(draft, actor.id)).resolves.toEqual(published);

    await seedReferralPurchase(db, referrer.id);
    const { code } = await referrals.issueCode(referrer.id);
    const accepted = await referrals.claim(first.id, code);
    const underReview = await referrals.claim(second.id, code);
    const warehouse = await db.warehouse.create({ data: { code: 'rf03', name: 'RF03 Warehouse' } });
    const sharedHash = 'a'.repeat(64);
    await db.referralRiskObservation.createMany({
      data: [
        {
          userId: referrer.id,
          networkHash: sharedHash,
          deviceHash: sharedHash,
          recordedAt: new Date(),
        },
        {
          userId: first.id,
          networkHash: sharedHash,
          deviceHash: 'b'.repeat(64),
          recordedAt: new Date(),
        },
        {
          userId: second.id,
          networkHash: sharedHash,
          deviceHash: sharedHash,
          recordedAt: new Date(),
        },
      ],
    });
    for (const customer of [first, second]) {
      const order = await db.order.create({
        data: {
          orderNumber: randomUUID().replaceAll('-', ''),
          userId: customer.id,
          warehouseId: warehouse.id,
          reservationExpiresAt: new Date(Date.now() + day),
          merchandiseTotalToman: 25_000,
          grandTotalToman: 25_000,
          payment: { create: { amountToman: 25_000 } },
        },
      });
      await db.$transaction(async (tx) => {
        const paidAt = new Date();
        await tx.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt } });
        await tx.payment.update({ where: { orderId: order.id }, data: { status: 'PAID', paidAt } });
      });
    }
    const assessedAt = new Date();
    const counts = await Promise.all([risk.run(assessedAt), risk.run(assessedAt)]);
    expect(counts[0] + counts[1]).toBe(2);
    await expect(risk.read(accepted.id)).resolves.toMatchObject({
      action: 'ALLOW',
      evidence: [{ code: 'SHARED_NETWORK' }],
    });
    await expect(risk.read(underReview.id)).resolves.toMatchObject({
      action: 'HOLD',
      revision: 1,
      overdue: false,
    });
    await expect(
      db.order.count({ where: { status: 'PAID', userId: { in: [first.id, second.id] } } }),
    ).resolves.toBe(2);
    await expect(db.walletLot.count()).resolves.toBe(0);

    const changed = await policies.publish(
      {
        requestId: randomUUID(),
        expectedVersion: published.version,
        definition: defaultReferralRiskPolicy(),
      },
      actor.id,
    );
    expect(changed.version).not.toBe(published.version);
    await expect(risk.run()).resolves.toBe(0);
    await expect(risk.read(underReview.id)).resolves.toMatchObject({
      policyVersion: published.version,
      action: 'HOLD',
    });

    const fixture = await Test.createTestingModule({
      controllers: [ReferralRiskController, ReferralsController],
      providers: [
        { provide: ReferralRiskService, useValue: risk },
        { provide: ReferralRiskPoliciesService, useValue: policies },
        { provide: ReferralsService, useValue: referrals },
        {
          provide: ReferralRiskObservationsService,
          useValue: new ReferralRiskObservationsService(db, new ConfigService()),
        },
      ],
    }).compile();
    app = fixture.createNestApplication<INestApplication<App>>();
    configureApiRouting(app);
    let permissionCodes: PermissionCode[] = [
      PERMISSION_CODES.FINANCE_READ,
      PERMISSION_CODES.FINANCE_WRITE,
    ];
    app.use((req: Request & RequestWithAuth, _res: Response, next: NextFunction) => {
      if (req.header('x-test-role') === 'reviewer') {
        req.auth = {
          userId: actor.id,
          phone: actor.phone,
          sessionId: actor.id,
          roleCodes: [],
          permissionCodes,
        };
      }
      next();
    });
    app.useGlobalGuards(new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    const api = request(app.getHttpServer());
    const queue = '/api/v1/referral-risk/cases';
    await api.get(queue).expect(401);
    await api
      .post('/api/v1/referrals/claim')
      .set('x-test-role', 'reviewer')
      .send({ code, referredUserId: first.id })
      .expect(400);
    const listed = await api.get(queue).set('x-test-role', 'reviewer').expect(200);
    expect(listed.body.items).toMatchObject([{ attributionId: underReview.id }]);
    expect(listed.text).not.toContain(sharedHash);
    const decision = {
      expectedRevision: 1,
      action: 'ALLOW',
      reason: 'Verified qualifying purchase',
    };
    permissionCodes = [PERMISSION_CODES.FINANCE_READ];
    await api
      .post(`${queue}/${underReview.id}/decisions`)
      .set('x-test-role', 'reviewer')
      .send(decision)
      .expect(403);
    permissionCodes = [PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE];
    await api
      .post(`${queue}/${underReview.id}/decisions`)
      .set('x-test-role', 'reviewer')
      .send(decision)
      .expect(201);
    await api
      .post(`${queue}/${underReview.id}/decisions`)
      .set('x-test-role', 'reviewer')
      .send(decision)
      .expect(409);
    const afterExpiry = new Date(+assessedAt + 91 * day);
    await risk.cleanup(afterExpiry);
    await expect(db.referralRiskObservation.count()).resolves.toBe(0);
    await expect(risk.read(underReview.id, afterExpiry)).resolves.toMatchObject({
      action: 'ALLOW',
      evidence: null,
      revision: 2,
      reviews: [{ action: 'ALLOW', fromAction: 'HOLD', reason: decision.reason }],
    });
  } finally {
    try {
      await app?.close();
    } finally {
      await close();
    }
  }
}, 120_000);
