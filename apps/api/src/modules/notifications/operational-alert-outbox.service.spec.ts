import { OperationalAlertLevel } from '../../generated/prisma/enums';
import { ROLE_CODES } from '../authorization/rbac.constants';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OperationalAlertOutboxService } from './operational-alert-outbox.service';

describe('OperationalAlertOutboxService', () => {
  it('fans one incident out to active operational staff with database deduplication', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '10000000-0000-4000-8000-000000000001',
            phone: '+989120000001',
          },
          {
            id: '10000000-0000-4000-8000-000000000002',
            phone: '+989120000002',
          },
        ]),
      },
      operationalAlertOutboxEvent: {
        createMany: jest.fn().mockResolvedValue({
          count: 2,
        }),
      },
    };
    const service = new OperationalAlertOutboxService(prisma as unknown as PrismaService);

    const result = await service.enqueueMany([
      {
        orderId: '20000000-0000-4000-8000-000000000001',
        orderNumber: 'HS-051',
        code: 'PLATING_OVERDUE',
        level: OperationalAlertLevel.INITIAL,
        priority: 'HIGH',
        incidentFingerprint:
          'PLATING_OVERDUE:20000000-0000-4000-8000-000000000001:2026-08-30T10:00:00.000Z',
        dueAt: new Date('2026-08-30T10:00:00.000Z'),
        payload: {
          orderNumber: 'HS-051',
        },
      },
    ]);

    expect(result).toEqual({
      recipientCount: 2,
      candidateCount: 1,
      enqueuedCount: 2,
    });
    expect(prisma.operationalAlertOutboxEvent.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          recipientUserId: '10000000-0000-4000-8000-000000000001',
          code: 'PLATING_OVERDUE',
          level: OperationalAlertLevel.INITIAL,
        }),
        expect.objectContaining({
          recipientUserId: '10000000-0000-4000-8000-000000000002',
          code: 'PLATING_OVERDUE',
          level: OperationalAlertLevel.INITIAL,
        }),
      ]),
      skipDuplicates: true,
    });
  });
  it('can restrict sensitive operational alerts to Managers only', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      operationalAlertOutboxEvent: {
        createMany: jest.fn(),
      },
    };
    const service = new OperationalAlertOutboxService(prisma as unknown as PrismaService);

    await service.enqueueMany(
      [
        {
          orderId: '20000000-0000-4000-8000-000000000001',
          orderNumber: 'HS-FIN-1',
          code: 'PAYMENT_INITIATION_STUCK',
          level: OperationalAlertLevel.INITIAL,
          priority: 'HIGH',
          incidentFingerprint: 'PAYMENT_INITIATION_STUCK:30000000-0000-4000-8000-000000000001',
          dueAt: new Date('2026-08-31T14:00:00.000Z'),
          payload: {
            paymentAttemptId: '30000000-0000-4000-8000-000000000001',
          },
        },
      ],
      [ROLE_CODES.MANAGER],
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          roles: {
            some: {
              role: expect.objectContaining({
                code: {
                  in: [ROLE_CODES.MANAGER],
                },
              }),
            },
          },
        }),
      }),
    );
  });
});
