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
import { bucketField } from '../src/modules/wallet/wallet-ledger';
import { WalletLedgerService } from '../src/modules/wallet/wallet-ledger.service';
import { WalletController } from '../src/modules/wallet/wallet.controller';

it('serializes concurrent spend, preserves append-only movements and reconciles the wallet snapshot', async () => {
  const db = new PrismaService(new ConfigService());
  const wallet = new WalletLedgerService(db);
  const suffix = randomUUID();
  const phone = `+0${BigInt(`0x${suffix.replaceAll('-', '').slice(0, 12)}`)}`;
  let app: INestApplication<App> | undefined;

  try {
    const [buyer, other] = await Promise.all([
      db.user.create({ data: { phone } }),
      db.user.create({ data: { phone: `${phone}1` } }),
    ]);
    const warehouse = await db.warehouse.create({
      data: { code: `wl02-${suffix}`, name: 'Wallet test warehouse' },
    });
    const now = new Date();
    const expiry = new Date(+now + 86_400_000);
    const laterExpiry = new Date(+expiry + 86_400_000);
    const policy = await db.rewardPolicyVersion.create({
      data: {
        requestId: randomUUID(),
        definition: { enabled: true },
        createdById: other.id,
        publishedById: other.id,
        publishedAt: now,
        effectiveAt: now,
      },
    });
    function order(userId: string, paid: boolean) {
      return db.order.create({
        data: {
          orderNumber: randomUUID().replaceAll('-', ''),
          userId,
          warehouseId: warehouse.id,
          status: paid ? 'PAID' : 'PENDING_PAYMENT',
          paidAt: paid ? now : null,
          merchandiseTotalToman: 30_000,
          grandTotalToman: 30_000,
          reservationExpiresAt: expiry,
          ...(paid
            ? { payment: { create: { amountToman: 30_000, paidAt: now, status: 'PAID' } } }
            : {}),
        },
      });
    }
    const [purchase, referral, first, second, outsiderOrder] = await Promise.all([
      order(buyer.id, true),
      order(other.id, true),
      order(buyer.id, false),
      order(buyer.id, false),
      order(other.id, false),
    ]);
    const requestFor = (idempotencyKey: string) => ({ userId: buyer.id, idempotencyKey });
    const purchaseGrant = {
      ...requestFor('purchase'),
      orderId: purchase.id,
      policyVersion: policy.version,
      source: 'PURCHASE' as const,
      sourceKey: purchase.id,
      amountToman: 4_000,
      expiresAt: expiry,
    };
    const late = await wallet.grant({
      ...requestFor('referral'),
      orderId: referral.id,
      policyVersion: policy.version,
      source: 'REFERRAL',
      sourceKey: referral.id,
      amountToman: 6_000,
      expiresAt: laterExpiry,
    });
    const early = await wallet.grant(purchaseGrant);
    const earlyLotId = early.movements[0].lotId;
    const lateLotId = late.movements[0].lotId;
    await expect(wallet.grant(purchaseGrant)).resolves.toEqual(early);
    await expect(wallet.grant({ ...purchaseGrant, amountToman: 5_000 })).rejects.toThrow(
      'different values',
    );
    await expect(
      wallet.grant({ ...purchaseGrant, ...requestFor('duplicate'), sourceKey: 'another-source' }),
    ).rejects.toThrow('already recorded');
    await expect(wallet.balance(buyer.id)).resolves.toMatchObject({
      pendingToman: 10_000,
      availableToman: 0,
      reservedToman: 0,
    });
    await wallet.activate({ ...requestFor('early-activate'), lotId: earlyLotId });
    await wallet.activate({ ...requestFor('late-activate'), lotId: lateLotId });
    await expect(
      wallet.expire({ ...requestFor('early-expire'), lotId: earlyLotId }),
    ).rejects.toThrow('has not expired');
    await expect(
      wallet.reserve({
        ...requestFor('foreign-order'),
        orderId: outsiderOrder.id,
        amountToman: 500,
      }),
    ).rejects.toThrow('cannot reserve');
    await expect(wallet.balance(buyer.id)).resolves.toMatchObject({
      pendingToman: 0,
      availableToman: 10_000,
      reservedToman: 0,
      nextExpiryAt: expiry.toISOString(),
    });

    const attempts = [first, second].map(({ id }, index) => ({
      ...requestFor(`reserve-${index}`),
      orderId: id,
      amountToman: 7_500,
    }));
    const raced = await Promise.allSettled(attempts.map((input) => wallet.reserve(input)));
    expect(raced.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const selected = raced.findIndex((result) => result.status === 'fulfilled');
    const rejected = raced[1 - selected];
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: { message: 'Insufficient available wallet credit.' },
    });
    const reserved = await wallet.reserve(attempts[selected]);
    expect(reserved.movements).toMatchObject([
      { lotId: earlyLotId, amountToman: 4_000, toBucket: 'RESERVED' },
      { lotId: lateLotId, amountToman: 3_500, toBucket: 'RESERVED' },
    ]);
    const reservationId = reserved.movements[0].reservationId;
    if (!reservationId) throw new Error('Expected reservation reference in the wallet journal.');

    const abort = new Error('Roll back enclosing payment unit of work');
    await expect(
      db.$transaction(async (tx) => {
        await wallet.release({ ...requestFor('aborted-release'), reservationId }, tx);
        throw abort;
      }),
    ).rejects.toBe(abort);
    await expect(wallet.balance(buyer.id)).resolves.toMatchObject({
      availableToman: 2_500,
      reservedToman: 7_500,
    });

    const releaseInput = { ...requestFor('release'), reservationId };
    const released = await wallet.release(releaseInput);
    await expect(wallet.release(releaseInput)).resolves.toEqual(released);
    await expect(wallet.balance(buyer.id)).resolves.toMatchObject({
      availableToman: 10_000,
      reservedToman: 0,
    });
    const reservedAgain = await wallet.reserve({
      ...attempts[selected],
      ...requestFor('reserve-after-release'),
    });
    const newReservationId = reservedAgain.movements[0].reservationId;
    if (!newReservationId) throw new Error('Expected a new wallet reservation reference.');
    expect(newReservationId).not.toBe(reservationId);

    const captureInput = { ...requestFor('capture'), reservationId: newReservationId };
    const captured = await wallet.capture(captureInput);
    await expect(wallet.capture(captureInput)).resolves.toEqual(captured);
    await expect(
      wallet.release({ ...requestFor('late-release'), reservationId: newReservationId }),
    ).rejects.toThrow('already resolved');
    await wallet.reverseCapture({
      ...requestFor('return'),
      reservationId: newReservationId,
      amountToman: 3_000,
    });
    await expect(
      wallet.reverseCapture({
        ...requestFor('too-much'),
        reservationId: newReservationId,
        amountToman: 4_501,
      }),
    ).rejects.toThrow('exceeds the remaining capture');

    const module = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [{ provide: WalletLedgerService, useValue: wallet }],
    }).compile();
    app = module.createNestApplication<INestApplication<App>>();
    configureApiRouting(app);
    app.use((req: Request & RequestWithAuth, _res: Response, next: NextFunction) => {
      const role = req.header('x-test-role');
      if (role === 'customer' || role === 'reader' || role === 'writer') {
        req.auth = {
          sessionId: other.id,
          userId: other.id,
          phone: other.phone,
          roleCodes: [],
          permissionCodes:
            role === 'customer'
              ? []
              : role === 'reader'
                ? [PERMISSION_CODES.FINANCE_READ]
                : [PERMISSION_CODES.FINANCE_READ, PERMISSION_CODES.FINANCE_WRITE],
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
    const admin = `/api/v1/wallet/admin/${buyer.id}`;
    const correction = {
      requestId: randomUUID(),
      targetId: earlyLotId,
      kind: 'REVOKE_GRANT',
      amountToman: 1_000,
      reason: 'اصلاح تخصیص نمونه',
    };
    await api
      .get('/api/v1/wallet')
      .set('x-test-role', 'customer')
      .expect(200)
      .expect({ pendingToman: 0, availableToman: 0, reservedToman: 0, nextExpiryAt: null });
    await api.get(`${admin}/ledger`).set('x-test-role', 'customer').expect(403);
    await api
      .post(`${admin}/corrections`)
      .set('x-test-role', 'reader')
      .send(correction)
      .expect(403);
    await api
      .post(`${admin}/corrections`)
      .set('x-test-role', 'writer')
      .send({ ...correction, reason: ' ' })
      .expect(400);
    const corrected = await api
      .post(`${admin}/corrections`)
      .set('x-test-role', 'writer')
      .send(correction)
      .expect(201);
    expect(corrected.body).toMatchObject({
      actorUserId: other.id,
      reason: correction.reason,
      movements: [{ lotId: earlyLotId, amountToman: 1_000, toBucket: 'REVOKED' }],
    });
    await api.get(`${admin}/ledger`).set('x-test-role', 'reader').expect(200);

    // Seed a historically granted pending lot so expiry is deterministic without waiting.
    const expiredAt = new Date(+now - 60_000);
    const grantedAt = new Date(+expiredAt - 60_000);
    const expiredLot = await db.$transaction(async (tx) => {
      const lot = await tx.walletLot.create({
        data: {
          userId: buyer.id,
          orderId: referral.id,
          policyVersion: policy.version,
          source: 'REFERRAL',
          sourceKey: `historical-${suffix}`,
          grantedToman: 600,
          pendingToman: 600,
          createdAt: grantedAt,
          expiresAt: expiredAt,
        },
      });
      await tx.walletOperation.create({
        data: {
          userId: buyer.id,
          idempotencyKey: 'historical-grant',
          fingerprint: '0'.repeat(64),
          kind: 'GRANT',
          recordedAt: grantedAt,
          entries: { create: { lotId: lot.id, amountToman: 600, toBucket: 'PENDING' } },
        },
      });
      return lot;
    });
    await expect(wallet.balance(buyer.id)).resolves.toMatchObject({ pendingToman: 0 });
    const expiryInput = { ...requestFor('expire'), lotId: expiredLot.id };
    const expired = await wallet.expire(expiryInput);
    expect(expired.movements).toMatchObject([{ amountToman: 600, toBucket: 'EXPIRED' }]);
    await expect(wallet.expire(expiryInput)).resolves.toEqual(expired);

    const lots = await db.walletLot.findMany({
      where: { userId: buyer.id },
      include: { entries: true },
    });
    for (const lot of lots) {
      const snapshot = {
        pendingToman: 0,
        availableToman: 0,
        reservedToman: 0,
        capturedToman: 0,
        expiredToman: 0,
        revokedToman: 0,
      };
      for (const entry of lot.entries) {
        if (entry.fromBucket) snapshot[bucketField[entry.fromBucket]] -= entry.amountToman;
        snapshot[bucketField[entry.toBucket]] += entry.amountToman;
      }
      expect(lot).toMatchObject(snapshot);
      expect(Object.values(snapshot).reduce((sum, amount) => sum + amount, 0)).toBe(
        lot.grantedToman,
      );
    }
    await expect(wallet.balance(buyer.id)).resolves.toMatchObject({
      pendingToman: 0,
      availableToman: 4_500,
      reservedToman: 0,
    });
    const journalId = lots[0].entries[0].id;
    await expect(
      db.walletLedgerEntry.update({ where: { id: journalId }, data: { amountToman: 1 } }),
    ).rejects.toThrow();
    await expect(db.walletOperation.delete({ where: { id: early.id } })).rejects.toThrow();
  } finally {
    try {
      await app?.close();
    } finally {
      await db.$disconnect();
    }
  }
}, 45_000);
