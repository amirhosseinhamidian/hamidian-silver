import {
  OrderCostEntryType,
  OrderStatus,
  PlatingFulfillmentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { OrderCostsService } from '../finance/order-costs.service';
import { PlatingFulfillmentService } from './plating-fulfillment.service';

describe('PlatingFulfillmentService', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const fulfillmentId = '30000000-0000-4000-8000-000000000001';

  it('starts plating idempotently for a paid plating order', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          status: OrderStatus.PAID,
          platingTotalToman: 250_000,
          financeSnapshot: {
            id: '40000000-0000-4000-8000-000000000001',
          },
        }),
      },
      orderPlatingFulfillment: {
        upsert: jest.fn().mockResolvedValue({
          id: fulfillmentId,
          status: PlatingFulfillmentStatus.IN_PROGRESS,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: fulfillmentId,
          orderId,
          status: PlatingFulfillmentStatus.IN_PROGRESS,
        }),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PlatingFulfillmentService(
      prisma as unknown as PrismaService,
      {} as OrderCostsService,
    );

    await service.start(orderId, actorUserId, {
      note: 'Send to plating workshop.',
    });

    expect(transaction.orderPlatingFulfillment.upsert).toHaveBeenCalledWith({
      where: {
        orderId,
      },
      update: {},
      create: expect.objectContaining({
        orderId,
        status: PlatingFulfillmentStatus.IN_PROGRESS,
        startedByUserId: actorUserId,
        startedAt: expect.any(Date),
        startNote: 'Send to plating workshop.',
      }),
    });
    expect(transaction.orderPlatingFulfillment.updateMany).not.toHaveBeenCalled();
  });

  it('completes plating and records the actual service cost in the immutable ledger', async () => {
    const transaction = {
      orderPlatingFulfillment: {
        findUnique: jest.fn().mockResolvedValue({
          id: fulfillmentId,
          orderId,
          status: PlatingFulfillmentStatus.IN_PROGRESS,
          actualCostToman: null,
          externalReference: null,
          order: {
            id: orderId,
            platingTotalToman: 250_000,
            financeSnapshot: {
              id: '40000000-0000-4000-8000-000000000001',
            },
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: fulfillmentId,
          orderId,
          status: PlatingFulfillmentStatus.COMPLETED,
          actualCostToman: 140_000,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const orderCosts = {
      recordActualCost: jest.fn().mockResolvedValue({
        id: '50000000-0000-4000-8000-000000000001',
      }),
    };
    const service = new PlatingFulfillmentService(
      prisma as unknown as PrismaService,
      orderCosts as unknown as OrderCostsService,
    );

    await service.complete(orderId, actorUserId, {
      actualCostToman: 140_000,
      externalReference: 'PLATING-INVOICE-001',
      note: 'Workshop invoice received.',
    });

    expect(transaction.orderPlatingFulfillment.updateMany).toHaveBeenCalledWith({
      where: {
        id: fulfillmentId,
        status: PlatingFulfillmentStatus.IN_PROGRESS,
      },
      data: expect.objectContaining({
        status: PlatingFulfillmentStatus.COMPLETED,
        actualCostToman: 140_000,
        externalReference: 'PLATING-INVOICE-001',
        completedByUserId: actorUserId,
        completedAt: expect.any(Date),
      }),
    });

    expect(orderCosts.recordActualCost).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        orderId,
        type: OrderCostEntryType.PLATING_SERVICE,
        amountToman: 140_000,
        source: 'plating-fulfillment',
        externalReference: 'PLATING-INVOICE-001',
        idempotencyKey: `plating-fulfillment:${fulfillmentId}:actual-cost`,
        createdByUserId: actorUserId,
      }),
    );
  });

  it('accepts an identical completion retry without writing a second cost', async () => {
    const transaction = {
      orderPlatingFulfillment: {
        findUnique: jest.fn().mockResolvedValue({
          id: fulfillmentId,
          orderId,
          status: PlatingFulfillmentStatus.COMPLETED,
          actualCostToman: 140_000,
          externalReference: 'PLATING-INVOICE-001',
          order: {
            id: orderId,
            platingTotalToman: 250_000,
            financeSnapshot: {
              id: '40000000-0000-4000-8000-000000000001',
            },
          },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: fulfillmentId,
          orderId,
          status: PlatingFulfillmentStatus.COMPLETED,
          actualCostToman: 140_000,
        }),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const orderCosts = {
      recordActualCost: jest.fn(),
    };
    const service = new PlatingFulfillmentService(
      prisma as unknown as PrismaService,
      orderCosts as unknown as OrderCostsService,
    );

    await service.complete(orderId, actorUserId, {
      actualCostToman: 140_000,
      externalReference: 'PLATING-INVOICE-001',
    });

    expect(transaction.orderPlatingFulfillment.updateMany).not.toHaveBeenCalled();
    expect(orderCosts.recordActualCost).not.toHaveBeenCalled();
  });

  it('cancels an unfinished fulfillment without fabricating a service cost', async () => {
    const transaction = {
      orderPlatingFulfillment: {
        findUnique: jest.fn().mockResolvedValue({
          id: fulfillmentId,
          orderId,
          status: PlatingFulfillmentStatus.IN_PROGRESS,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: fulfillmentId,
          orderId,
          status: PlatingFulfillmentStatus.CANCELLED,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const orderCosts = {
      recordActualCost: jest.fn(),
    };
    const service = new PlatingFulfillmentService(
      prisma as unknown as PrismaService,
      orderCosts as unknown as OrderCostsService,
    );

    await service.cancel(orderId, actorUserId, {
      reason: 'Order operation changed.',
    });

    expect(transaction.orderPlatingFulfillment.updateMany).toHaveBeenCalledWith({
      where: {
        id: fulfillmentId,
        status: {
          in: [PlatingFulfillmentStatus.PENDING, PlatingFulfillmentStatus.IN_PROGRESS],
        },
      },
      data: expect.objectContaining({
        status: PlatingFulfillmentStatus.CANCELLED,
        cancelledByUserId: actorUserId,
        cancelledAt: expect.any(Date),
        cancellationReason: 'Order operation changed.',
      }),
    });
    expect(orderCosts.recordActualCost).not.toHaveBeenCalled();
  });
});
