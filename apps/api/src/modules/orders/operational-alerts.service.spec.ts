import { OperationalAlertLevel, OrderStatus } from '../../generated/prisma/enums';
import type { OperationalAlertOutboxService } from '../notifications/operational-alert-outbox.service';
import { OperationalAlertsService } from './operational-alerts.service';
import type { OperationsWorkQueueService } from './operations-work-queue.service';

describe('OperationalAlertsService', () => {
  it('enqueues only alert-worthy work queue incidents', async () => {
    const workQueue = {
      snapshot: jest.fn().mockResolvedValue([
        {
          orderId: '10000000-0000-4000-8000-000000000001',
          orderNumber: 'HS-051',
          orderStatus: OrderStatus.PROCESSING,
          workType: 'PLATING',
          code: 'PLATING_OVERDUE',
          state: 'OVERDUE',
          priority: 'HIGH',
          dueAt: new Date('2026-08-29T10:00:00.000Z'),
          overdue: true,
          ageMinutes: 2_000,
          context: {},
        },
        {
          orderId: '20000000-0000-4000-8000-000000000001',
          orderNumber: 'HS-READY',
          orderStatus: OrderStatus.PROCESSING,
          workType: 'SHIPPING',
          code: 'READY_FOR_HANDOFF',
          state: 'READY',
          priority: 'MEDIUM',
          dueAt: null,
          overdue: false,
          ageMinutes: 30,
          context: {},
        },
      ]),
    };
    const outbox = {
      enqueueMany: jest.fn().mockResolvedValue({
        recipientCount: 2,
        candidateCount: 2,
        enqueuedCount: 4,
      }),
    };
    const service = new OperationalAlertsService(
      workQueue as unknown as OperationsWorkQueueService,
      outbox as unknown as OperationalAlertOutboxService,
    );

    const result = await service.scan(new Date('2026-08-30T12:00:00.000Z'));

    expect(result.activeIncidentCount).toBe(1);
    expect(outbox.enqueueMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PLATING_OVERDUE',
          level: OperationalAlertLevel.INITIAL,
        }),
        expect.objectContaining({
          code: 'PLATING_OVERDUE',
          level: OperationalAlertLevel.ESCALATION,
        }),
      ]),
    );
  });
});
