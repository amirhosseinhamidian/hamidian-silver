import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrderStatus, PaymentAttemptStatus, PaymentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  PaymentInitiationRecoveryResolution,
  type ResolvePaymentInitiationRecoveryDto,
} from './dto/resolve-payment-initiation-recovery.dto';
import type { PaymentInitiationRecoveryPolicy } from './payment-initiation-recovery-policy';
import { PaymentInitiationRecoveryService } from './payment-initiation-recovery.service';

describe('PaymentInitiationRecoveryService', () => {
  const now = new Date('2026-08-31T14:00:00.000Z');
  const attemptId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const actorUserId = '40000000-0000-4000-8000-000000000001';

  function attempt(overrides: Record<string, unknown> = {}) {
    return {
      id: attemptId,
      provider: 'zarinpal',
      status: PaymentAttemptStatus.CREATED,
      amountToman: 1_000_000,
      authority: null,
      paymentUrl: null,
      failureCode: null,
      initiationRecoveryResolution: null,
      initiationRecoveryNote: null,
      initiationRecoveryResolvedByUserId: null,
      initiationRecoveryResolvedAt: null,
      createdAt: new Date(now.getTime() - 5 * 60 * 1000),
      payment: {
        id: '30000000-0000-4000-8000-000000000001',
        orderId,
        status: PaymentStatus.PENDING,
        amountToman: 1_000_000,
        order: {
          id: orderId,
          orderNumber: 'HS-RECOVERY',
          status: OrderStatus.PENDING_PAYMENT,
          grandTotalToman: 1_000_000,
          reservationExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        },
      },
      ...overrides,
    };
  }

  function harness(currentAttempt = attempt()) {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      paymentAttempt: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            payment: {
              orderId,
            },
          })
          .mockResolvedValueOnce(currentAttempt),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...currentAttempt,
          status: PaymentAttemptStatus.FAILED,
        }),
      },
    };
    const prisma = {
      paymentAttempt: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const recoveryPolicy = {
      requireCanonicalRedirect: jest.fn(({ paymentUrl }: { paymentUrl: string }) => paymentUrl),
    };
    const service = new PaymentInitiationRecoveryService(
      prisma as unknown as PrismaService,
      recoveryPolicy as unknown as PaymentInitiationRecoveryPolicy,
    );

    return { service, prisma, transaction, recoveryPolicy };
  }

  it('lists only aged created attempts as recovery candidates', async () => {
    const { service, prisma } = harness();

    prisma.paymentAttempt.findMany.mockResolvedValue([]);

    await service.listCandidates(now);

    expect(prisma.paymentAttempt.findMany).toHaveBeenCalledWith({
      where: {
        status: PaymentAttemptStatus.CREATED,
        createdAt: {
          lte: new Date(now.getTime() - 2 * 60 * 1000),
        },
      },
      take: 100,
      orderBy: {
        createdAt: 'asc',
      },
      select: expect.any(Object),
    });
  });

  it('abandons an aged unknown attempt with a CAS transition to FAILED', async () => {
    const { service, transaction } = harness();
    const dto: ResolvePaymentInitiationRecoveryDto = {
      resolution: PaymentInitiationRecoveryResolution.ABANDONED,
    };

    await service.resolve(attemptId, actorUserId, dto, now);

    expect(transaction.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: attemptId,
        status: PaymentAttemptStatus.CREATED,
        createdAt: {
          lte: new Date(now.getTime() - 2 * 60 * 1000),
        },
      },
      data: {
        status: PaymentAttemptStatus.FAILED,
        failureCode: 'INITIATION_RECOVERY_ABANDONED',
        failureMessage: 'Manager abandoned an unknown payment initiation after provider review.',
        initiationRecoveryResolution: PaymentInitiationRecoveryResolution.ABANDONED,
        initiationRecoveryNote: null,
        initiationRecoveryResolvedByUserId: actorUserId,
        initiationRecoveryResolvedAt: now,
      },
    });
  });

  it('restores a usable provider redirect only while the order is still payable', async () => {
    const redirected = {
      ...attempt(),
      status: PaymentAttemptStatus.REDIRECTED,
      authority: 'AUTH-RECOVERED',
      paymentUrl: 'https://gateway.example/pay/AUTH-RECOVERED',
      initiationRecoveryResolution: PaymentInitiationRecoveryResolution.REDIRECTED,
      initiationRecoveryNote: null,
      initiationRecoveryResolvedByUserId: actorUserId,
      initiationRecoveryResolvedAt: now,
    };
    const { service, transaction } = harness();

    transaction.paymentAttempt.findUniqueOrThrow.mockResolvedValue(redirected);

    await expect(
      service.resolve(
        attemptId,
        actorUserId,
        {
          resolution: PaymentInitiationRecoveryResolution.REDIRECTED,
          authority: 'AUTH-RECOVERED',
          paymentUrl: 'https://gateway.example/pay/AUTH-RECOVERED',
        },
        now,
      ),
    ).resolves.toBe(redirected);

    expect(transaction.paymentAttempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: PaymentAttemptStatus.REDIRECTED,
          authority: 'AUTH-RECOVERED',
          paymentUrl: 'https://gateway.example/pay/AUTH-RECOVERED',
          failureCode: null,
          failureMessage: null,
          initiationRecoveryResolution: PaymentInitiationRecoveryResolution.REDIRECTED,
          initiationRecoveryNote: null,
          initiationRecoveryResolvedByUserId: actorUserId,
          initiationRecoveryResolvedAt: now,
        },
      }),
    );
  });

  it('rejects restoring a redirect after the order reservation has expired', async () => {
    const expiredAttempt = attempt({
      payment: {
        id: '30000000-0000-4000-8000-000000000001',
        orderId,
        status: PaymentStatus.PENDING,
        amountToman: 1_000_000,
        order: {
          id: orderId,
          orderNumber: 'HS-RECOVERY',
          status: OrderStatus.PENDING_PAYMENT,
          grandTotalToman: 1_000_000,
          reservationExpiresAt: new Date(now.getTime() - 1_000),
        },
      },
    });
    const { service, transaction } = harness(expiredAttempt);

    await expect(
      service.resolve(
        attemptId,
        actorUserId,
        {
          resolution: PaymentInitiationRecoveryResolution.REDIRECTED,
          authority: 'AUTH-RECOVERED',
          paymentUrl: 'https://gateway.example/pay/AUTH-RECOVERED',
        },
        now,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('rejects redirect fields when the Manager abandons the attempt', async () => {
    const { service } = harness();

    await expect(
      service.resolve(
        attemptId,
        actorUserId,
        {
          resolution: PaymentInitiationRecoveryResolution.ABANDONED,
          authority: 'AUTH-NOT-ALLOWED',
          paymentUrl: 'https://gateway.example/pay/AUTH-NOT-ALLOWED',
        },
        now,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a concurrent redirect that did not record recovery audit metadata', async () => {
    const redirectedWithoutAudit = {
      ...attempt(),
      status: PaymentAttemptStatus.REDIRECTED,
      authority: 'AUTH-RECOVERED',
      paymentUrl: 'https://gateway.example/pay/AUTH-RECOVERED',
    };
    const { service, transaction } = harness();

    transaction.paymentAttempt.updateMany.mockResolvedValue({ count: 0 });
    transaction.paymentAttempt.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        payment: {
          orderId,
        },
      })
      .mockResolvedValueOnce(attempt())
      .mockResolvedValueOnce(redirectedWithoutAudit);

    await expect(
      service.resolve(
        attemptId,
        actorUserId,
        {
          resolution: PaymentInitiationRecoveryResolution.REDIRECTED,
          authority: 'AUTH-RECOVERED',
          paymentUrl: 'https://gateway.example/pay/AUTH-RECOVERED',
        },
        now,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the concurrent winner idempotently for the same redirect', async () => {
    const redirected = {
      ...attempt(),
      status: PaymentAttemptStatus.REDIRECTED,
      authority: 'AUTH-RECOVERED',
      paymentUrl: 'https://gateway.example/pay/AUTH-RECOVERED',
      initiationRecoveryResolution: PaymentInitiationRecoveryResolution.REDIRECTED,
      initiationRecoveryNote: null,
      initiationRecoveryResolvedByUserId: actorUserId,
      initiationRecoveryResolvedAt: now,
    };
    const { service, transaction } = harness();

    transaction.paymentAttempt.updateMany.mockResolvedValue({ count: 0 });
    transaction.paymentAttempt.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        payment: {
          orderId,
        },
      })
      .mockResolvedValueOnce(attempt())
      .mockResolvedValueOnce(redirected);

    await expect(
      service.resolve(
        attemptId,
        actorUserId,
        {
          resolution: PaymentInitiationRecoveryResolution.REDIRECTED,
          authority: 'AUTH-RECOVERED',
          paymentUrl: 'https://gateway.example/pay/AUTH-RECOVERED',
        },
        now,
      ),
    ).resolves.toBe(redirected);
  });
});
