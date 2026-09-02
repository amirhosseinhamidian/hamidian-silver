import { OperationalIncidentActivityType, OrderStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OperationalIncidentsService } from './operational-incidents.service';
import type { OperationsWorkItem } from './operations-work-queue';

describe('OperationalIncidentsService', () => {
  const now = new Date('2026-08-30T12:00:00.000Z');
  const incidentId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';

  function overdueItem(): OperationsWorkItem {
    return {
      orderId,
      orderNumber: 'HS-052',
      orderStatus: OrderStatus.PROCESSING,
      workType: 'PLATING',
      code: 'PLATING_OVERDUE',
      state: 'OVERDUE',
      priority: 'HIGH',
      dueAt: new Date('2026-08-29T10:00:00.000Z'),
      overdue: true,
      ageMinutes: 2_000,
      context: {},
    };
  }

  it('creates the detection audit once across repeated scans', async () => {
    const transaction = {
      operationalIncident: {
        upsert: jest
          .fn()
          .mockResolvedValueOnce({
            id: incidentId,
            resolvedAt: null,
          })
          .mockResolvedValueOnce({
            id: incidentId,
            resolvedAt: null,
          }),
      },
      operationalIncidentActivity: {
        createMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
      operationalIncident: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new OperationalIncidentsService(prisma as unknown as PrismaService);

    const first = await service.syncFromWorkItems([overdueItem()], now);
    const second = await service.syncFromWorkItems([overdueItem()], now);

    expect(first).toEqual({
      activeCount: 1,
      createdCount: 1,
      reopenedCount: 0,
      resolvedCount: 0,
    });
    expect(second).toEqual({
      activeCount: 1,
      createdCount: 0,
      reopenedCount: 0,
      resolvedCount: 0,
    });
    expect(transaction.operationalIncidentActivity.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            type: OperationalIncidentActivityType.DETECTED,
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  it('reopens the same fingerprint if a resolved incident becomes active again', async () => {
    const previouslyResolvedAt = new Date('2026-08-30T08:00:00.000Z');
    const transaction = {
      operationalIncident: {
        upsert: jest.fn().mockResolvedValue({
          id: incidentId,
          resolvedAt: previouslyResolvedAt,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      operationalIncidentActivity: {
        createMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
      operationalIncident: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new OperationalIncidentsService(prisma as unknown as PrismaService);

    const result = await service.syncFromWorkItems([overdueItem()], now);

    expect(result).toEqual({
      activeCount: 1,
      createdCount: 0,
      reopenedCount: 1,
      resolvedCount: 0,
    });
    expect(transaction.operationalIncident.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: incidentId,
          resolvedAt: previouslyResolvedAt,
        },
        data: expect.objectContaining({
          resolvedAt: null,
          acknowledgedAt: null,
          assignedToUserId: null,
        }),
      }),
    );
    expect(transaction.operationalIncidentActivity.createMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            type: OperationalIncidentActivityType.REOPENED,
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  it('auto-resolves only after an incident leaves the derived work queue', async () => {
    const transaction = {
      operationalIncident: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      operationalIncidentActivity: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
      operationalIncident: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: incidentId,
            incidentFingerprint:
              'PLATING_OVERDUE:20000000-0000-4000-8000-000000000001:2026-08-29T10:00:00.000Z',
          },
        ]),
      },
    };
    const service = new OperationalIncidentsService(prisma as unknown as PrismaService);

    const result = await service.syncFromWorkItems([], now);

    expect(result.resolvedCount).toBe(1);
    expect(transaction.operationalIncident.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: incidentId,
          resolvedAt: null,
        },
        data: expect.objectContaining({
          resolvedAt: now,
        }),
      }),
    );
    expect(transaction.operationalIncidentActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        incidentId,
        type: OperationalIncidentActivityType.RESOLVED,
      }),
    });
  });
});
