import {
  OrderStatus,
  PlatingFulfillmentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { FulfillmentReadinessService } from './fulfillment-readiness.service';

describe('FulfillmentReadinessService', () => {
  const orderId = '10000000-0000-4000-8000-000000000001';

  it('marks a paid non-plated order with selected pending shipping as ready', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-049-A',
          status: OrderStatus.PAID,
          paidAt: new Date('2026-08-30T12:00:00.000Z'),
          platingTotalToman: 0,
          platingFulfillment: null,
          shipment: {
            id: '20000000-0000-4000-8000-000000000001',
            status: ShipmentStatus.PENDING,
            provider: 'postex',
            providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
            providerShipmentId: null,
            providerCreateError: null,
            creationAttemptedAt: null,
          },
        }),
      },
    };
    const service = new FulfillmentReadinessService(prisma as unknown as PrismaService);

    await expect(service.get(orderId)).resolves.toEqual(
      expect.objectContaining({
        state: 'READY',
        readyForProcessing: true,
        readyForShipmentCreation: true,
        checks: expect.objectContaining({
          plating: 'NOT_REQUIRED',
          shippingSelection: 'READY',
          providerCreation: 'NOT_STARTED',
        }),
        blockers: [],
      }),
    );
  });

  it('blocks shipment creation while required plating is in progress', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-049-B',
          status: OrderStatus.PROCESSING,
          paidAt: new Date('2026-08-30T12:00:00.000Z'),
          platingTotalToman: 200_000,
          platingFulfillment: {
            status: PlatingFulfillmentStatus.IN_PROGRESS,
          },
          shipment: {
            id: '20000000-0000-4000-8000-000000000001',
            status: ShipmentStatus.PENDING,
            provider: 'postex',
            providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
            providerShipmentId: null,
            providerCreateError: null,
            creationAttemptedAt: null,
          },
        }),
      },
    };
    const service = new FulfillmentReadinessService(prisma as unknown as PrismaService);

    const result = await service.get(orderId);

    expect(result.readyForShipmentCreation).toBe(false);
    expect(result.blockers).toContainEqual({
      code: 'PLATING_IN_PROGRESS',
    });
  });

  it('blocks a cancelled plating workflow from silently reaching shipping', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-049-C',
          status: OrderStatus.PROCESSING,
          paidAt: new Date('2026-08-30T12:00:00.000Z'),
          platingTotalToman: 200_000,
          platingFulfillment: {
            status: PlatingFulfillmentStatus.CANCELLED,
          },
          shipment: {
            id: '20000000-0000-4000-8000-000000000001',
            status: ShipmentStatus.PENDING,
            provider: 'postex',
            providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
            providerShipmentId: null,
            providerCreateError: null,
            creationAttemptedAt: null,
          },
        }),
      },
    };
    const service = new FulfillmentReadinessService(prisma as unknown as PrismaService);

    const result = await service.get(orderId);

    expect(result.readyForShipmentCreation).toBe(false);
    expect(result.blockers).toContainEqual({
      code: 'PLATING_CANCELLED',
    });
  });

  it('uses database-level derived filtering for READY operations queue', async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new FulfillmentReadinessService(prisma as unknown as PrismaService);

    await service.list({
      state: 'READY',
      limit: 25,
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        where: expect.objectContaining({
          status: {
            in: [OrderStatus.PAID, OrderStatus.PROCESSING],
          },
          shipment: {
            is: {
              status: ShipmentStatus.PENDING,
              providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
              providerShipmentId: null,
            },
          },
        }),
      }),
    );
  });
});
