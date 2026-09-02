import {
  OperationalAlertLevel,
  PaymentAttemptStatus,
  PaymentReconciliationStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ROLE_CODES } from '../authorization/rbac.constants';
import type { OperationalAlertOutboxService } from '../notifications/operational-alert-outbox.service';
import { PaymentOperationalObservabilityService } from './payment-operational-observability.service';

describe('PaymentOperationalObservabilityService', () => {
  const now = new Date('2026-08-31T15:00:00.000Z');

  function harness() {
    const prisma = {
      paymentAttempt: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      paymentReconciliation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const outbox = {
      enqueueMany: jest.fn().mockResolvedValue({
        recipientCount: 1,
        candidateCount: 0,
        enqueuedCount: 0,
      }),
    };
    const service = new PaymentOperationalObservabilityService(
      prisma as unknown as PrismaService,
      outbox as unknown as OperationalAlertOutboxService,
    );

    return { service, prisma, outbox };
  }

  it('summarizes stuck initiations and open reconciliations by provider', async () => {
    const { service, prisma } = harness();

    prisma.paymentAttempt.findMany.mockResolvedValue([
      {
        id: '10000000-0000-4000-8000-000000000001',
        provider: 'zarinpal',
        amountToman: 1_000_000,
        createdAt: new Date(now.getTime() - 10 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 10 * 60 * 1000),
        payment: {
          status: 'PENDING',
          order: {
            id: '20000000-0000-4000-8000-000000000001',
            orderNumber: 'HS-OBS-1',
            status: 'PENDING_PAYMENT',
          },
        },
      },
    ]);
    prisma.paymentReconciliation.findMany.mockResolvedValue([
      {
        id: '30000000-0000-4000-8000-000000000001',
        provider: 'zibal',
        amountToman: 1_000_000,
        reason: 'Late verified payment.',
        createdAt: new Date(now.getTime() - 40 * 60 * 1000),
        paymentAttempt: {
          id: '40000000-0000-4000-8000-000000000001',
          payment: {
            status: 'RECONCILIATION_REQUIRED',
            order: {
              id: '20000000-0000-4000-8000-000000000002',
              orderNumber: 'HS-OBS-2',
              status: 'EXPIRED',
            },
          },
        },
      },
    ]);

    await expect(service.summary(now)).resolves.toEqual({
      generatedAt: now,
      stuckInitiations: 1,
      openReconciliations: 1,
      escalatedInitiations: 0,
      escalatedReconciliations: 1,
      byProvider: {
        stuckInitiations: {
          zarinpal: 1,
        },
        openReconciliations: {
          zibal: 1,
        },
      },
    });

    expect(prisma.paymentAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: PaymentAttemptStatus.CREATED,
          createdAt: {
            lte: new Date(now.getTime() - 5 * 60 * 1000),
          },
        },
      }),
    );
    expect(prisma.paymentReconciliation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: PaymentReconciliationStatus.OPEN,
        },
      }),
    );
  });

  it('enqueues finance alerts for Managers only and escalates old reconciliation work', async () => {
    const { service, prisma, outbox } = harness();

    prisma.paymentAttempt.findMany.mockResolvedValue([
      {
        id: '10000000-0000-4000-8000-000000000001',
        provider: 'zarinpal',
        amountToman: 1_000_000,
        createdAt: new Date(now.getTime() - 10 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 10 * 60 * 1000),
        payment: {
          status: 'PENDING',
          order: {
            id: '20000000-0000-4000-8000-000000000001',
            orderNumber: 'HS-OBS-1',
            status: 'PENDING_PAYMENT',
          },
        },
      },
    ]);
    prisma.paymentReconciliation.findMany.mockResolvedValue([
      {
        id: '30000000-0000-4000-8000-000000000001',
        provider: 'zibal',
        amountToman: 1_000_000,
        reason: 'Late verified payment.',
        createdAt: new Date(now.getTime() - 40 * 60 * 1000),
        paymentAttempt: {
          id: '40000000-0000-4000-8000-000000000001',
          payment: {
            status: 'RECONCILIATION_REQUIRED',
            order: {
              id: '20000000-0000-4000-8000-000000000002',
              orderNumber: 'HS-OBS-2',
              status: 'EXPIRED',
            },
          },
        },
      },
    ]);

    await service.scan(now);

    expect(outbox.enqueueMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PAYMENT_INITIATION_STUCK',
          level: OperationalAlertLevel.INITIAL,
          incidentFingerprint: 'PAYMENT_INITIATION_STUCK:10000000-0000-4000-8000-000000000001',
        }),
        expect.objectContaining({
          code: 'PAYMENT_RECONCILIATION_OPEN',
          level: OperationalAlertLevel.ESCALATION,
          incidentFingerprint: 'PAYMENT_RECONCILIATION_OPEN:30000000-0000-4000-8000-000000000001',
        }),
      ]),
      [ROLE_CODES.MANAGER],
    );
  });

  it('does not alert a reconciliation until it has remained open for five minutes', async () => {
    const { service, prisma, outbox } = harness();

    prisma.paymentReconciliation.findMany.mockResolvedValue([
      {
        id: '30000000-0000-4000-8000-000000000001',
        provider: 'mellat',
        amountToman: 1_000_000,
        reason: 'Late verified payment.',
        createdAt: new Date(now.getTime() - 2 * 60 * 1000),
        paymentAttempt: {
          id: '40000000-0000-4000-8000-000000000001',
          payment: {
            status: 'RECONCILIATION_REQUIRED',
            order: {
              id: '20000000-0000-4000-8000-000000000001',
              orderNumber: 'HS-OBS-3',
              status: 'EXPIRED',
            },
          },
        },
      },
    ]);

    await service.scan(now);

    expect(outbox.enqueueMany).toHaveBeenCalledWith([], [ROLE_CODES.MANAGER]);
  });
});
