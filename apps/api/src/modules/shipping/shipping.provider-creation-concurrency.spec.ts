import { ConflictException } from '@nestjs/common';
import {
  OrderStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import { ShippingService } from './shipping.service';

describe('ShippingService provider creation concurrency', () => {
  const orderId = '10000000-0000-4000-8000-000000000001';
  const shipmentId = '20000000-0000-4000-8000-000000000001';
  const actorUserId = '30000000-0000-4000-8000-000000000001';

  const address = {
    recipientName: 'Test User',
    phone: '09120000000',
    province: 'Tehran',
    city: 'Tehran',
    addressLine: 'Test address',
    postalCode: '1234567890',
  };

  function baseShipment() {
    return {
      id: shipmentId,
      orderId,
      provider: 'postex',
      providerServiceCode: 'STANDARD',
      status: ShipmentStatus.PENDING,
      providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
      providerShipmentId: null,
      trackingCode: null,
      providerCreateError: null,
      creationAttemptedAt: null,
      shippingCostToman: 80_000,
      totalWeightGrams: {
        toString: () => '5.000',
      },
      order: {
        id: orderId,
        orderNumber: 'HS-CONCURRENCY',
        status: OrderStatus.PAID,
        paidAt: new Date('2026-08-31T09:00:00.000Z'),
        merchandiseTotalToman: 1_000_000,
        platingTotalToman: 0,
        discountTotalToman: 0,
        taxTotalToman: 0,
        grandTotalToman: 1_080_000,
        shippingAddress: address,
        platingFulfillment: null,
      },
    };
  }

  it('does not finalize a stale provider result after the creation state changed', async () => {
    const initial = baseShipment();
    const transaction = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue({
          ...initial,
          providerCreationState: ShipmentProviderCreationState.IN_PROGRESS,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      shipmentStatusHistory: {
        create: jest.fn(),
      },
    };
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(initial),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const provider = {
      providerCode: 'postex',
      quote: jest.fn(),
      createShipment: jest.fn().mockResolvedValue({
        providerShipmentId: 'PX-STALE',
        trackingCode: 'TRACK-STALE',
      }),
      track: jest.fn(),
    };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShippingProvider,
    );

    await expect(service.createProviderShipment(orderId, actorUserId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(transaction.shipment.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(transaction.shipmentStatusHistory.create).not.toHaveBeenCalled();
  });

  it('does not reset provider creation after another worker changes the state', async () => {
    const stale = {
      ...baseShipment(),
      providerCreationState: ShipmentProviderCreationState.UNKNOWN,
      creationAttemptedAt: new Date('2026-08-31T08:00:00.000Z'),
      providerCreateError: 'Provider response was uncertain',
    };
    const transaction = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(stale),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      shipmentStatusHistory: {
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const provider = {
      providerCode: 'postex',
    };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShippingProvider,
    );

    await expect(
      service.resetProviderCreation(
        orderId,
        {
          confirmNoProviderShipment: true,
          reason: 'Operator confirmed no external shipment',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.shipment.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(transaction.shipmentStatusHistory.create).not.toHaveBeenCalled();
  });
});
