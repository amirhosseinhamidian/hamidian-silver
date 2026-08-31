import { ConflictException } from '@nestjs/common';
import { OrderStatus, PlatingFulfillmentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { OrderCostsService } from '../finance/order-costs.service';
import { PlatingFulfillmentService } from './plating-fulfillment.service';

describe('PlatingFulfillmentService transition concurrency', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const fulfillmentId = '30000000-0000-4000-8000-000000000001';

  it('returns idempotently when another worker starts a pending fulfillment first', async () => {
    const started = {
      id: fulfillmentId,
      orderId,
      status: PlatingFulfillmentStatus.IN_PROGRESS,
    };
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
          orderId,
          status: PlatingFulfillmentStatus.PENDING,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          status: PlatingFulfillmentStatus.IN_PROGRESS,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(started),
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

    await expect(
      service.start(orderId, actorUserId, {
        note: 'Concurrent start.',
      }),
    ).resolves.toBe(started);
  });

  it('accepts an identical completion that wins the CAS race without duplicating cost', async () => {
    const completed = {
      id: fulfillmentId,
      orderId,
      status: PlatingFulfillmentStatus.COMPLETED,
      actualCostToman: 140_000,
      externalReference: 'PLATING-INVOICE-001',
    };
    const transaction = {
      orderPlatingFulfillment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
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
          })
          .mockResolvedValueOnce({
            status: PlatingFulfillmentStatus.COMPLETED,
            actualCostToman: 140_000,
            externalReference: 'PLATING-INVOICE-001',
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(completed),
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

    await expect(
      service.complete(orderId, actorUserId, {
        actualCostToman: 140_000,
        externalReference: 'PLATING-INVOICE-001',
      }),
    ).resolves.toBe(completed);

    expect(orderCosts.recordActualCost).not.toHaveBeenCalled();
  });

  it('rejects a stale completion when another worker completed with different financial data', async () => {
    const transaction = {
      orderPlatingFulfillment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
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
          })
          .mockResolvedValueOnce({
            status: PlatingFulfillmentStatus.COMPLETED,
            actualCostToman: 150_000,
            externalReference: 'PLATING-INVOICE-002',
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
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

    await expect(
      service.complete(orderId, actorUserId, {
        actualCostToman: 140_000,
        externalReference: 'PLATING-INVOICE-001',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(orderCosts.recordActualCost).not.toHaveBeenCalled();
  });

  it('returns idempotently when another worker cancels the fulfillment first', async () => {
    const cancelled = {
      id: fulfillmentId,
      orderId,
      status: PlatingFulfillmentStatus.CANCELLED,
    };
    const transaction = {
      orderPlatingFulfillment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: fulfillmentId,
            orderId,
            status: PlatingFulfillmentStatus.IN_PROGRESS,
          })
          .mockResolvedValueOnce({
            status: PlatingFulfillmentStatus.CANCELLED,
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(cancelled),
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

    await expect(
      service.cancel(orderId, actorUserId, {
        reason: 'Concurrent cancellation.',
      }),
    ).resolves.toBe(cancelled);

    expect(orderCosts.recordActualCost).not.toHaveBeenCalled();
  });

  it('does not let a stale cancellation override a concurrent completion', async () => {
    const transaction = {
      orderPlatingFulfillment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: fulfillmentId,
            orderId,
            status: PlatingFulfillmentStatus.IN_PROGRESS,
          })
          .mockResolvedValueOnce({
            status: PlatingFulfillmentStatus.COMPLETED,
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
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

    await expect(
      service.cancel(orderId, actorUserId, {
        reason: 'Stale cancellation.',
      }),
    ).rejects.toThrow(
      'Completed plating fulfillment cannot be cancelled; use a financial reversal if needed.',
    );
  });
});
