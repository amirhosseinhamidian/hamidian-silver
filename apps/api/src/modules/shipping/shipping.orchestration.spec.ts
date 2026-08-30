import {
  OrderStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import { ShippingService } from './shipping.service';

describe('ShippingService provider orchestration', () => {
  const orderId = '10000000-0000-4000-8000-000000000001';
  const shipmentId = '20000000-0000-4000-8000-000000000001';
  const actorUserId = '30000000-0000-4000-8000-000000000001';

  const provider: jest.Mocked<ShippingProvider> = {
    providerCode: 'postex',
    quote: jest.fn(),
    createShipment: jest.fn(),
    track: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims creation before the external call and stores provider identifiers once', async () => {
    const baseShipment = {
      id: shipmentId,
      orderId,
      provider: 'postex',
      providerServiceCode: 'POST|STANDARD',
      providerServiceName: 'Standard',
      status: ShipmentStatus.PENDING,
      providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
      providerShipmentId: null,
      trackingCode: null,
      providerCreateError: null,
      creationAttemptedAt: null,
      shippingCostToman: 50_000,
      totalWeightGrams: {
        toString: () => '12.500',
      },
      estimatedDeliveryDays: 3,
      shippedAt: null,
      deliveredAt: null,
      order: {
        id: orderId,
        orderNumber: 'HS-TEST',
        status: OrderStatus.PAID,
        merchandiseTotalToman: 1_000_000,
        platingTotalToman: 0,
        discountTotalToman: 0,
        taxTotalToman: 0,
        grandTotalToman: 1_050_000,
        shippingAddress: {
          recipientName: 'Test User',
          phone: '09120000000',
          province: 'Tehran',
          city: 'Tehran',
          addressLine: 'Test address',
          postalCode: '1234567890',
        },
      },
    };

    const transaction = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseShipment,
          providerCreationState: ShipmentProviderCreationState.IN_PROGRESS,
        }),
        update: jest.fn().mockResolvedValue({
          ...baseShipment,
          providerCreationState: ShipmentProviderCreationState.CREATED,
          providerShipmentId: 'PX-1',
          trackingCode: 'TRACK-1',
          status: ShipmentStatus.READY,
        }),
      },
      shipmentStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(baseShipment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };

    provider.createShipment.mockResolvedValue({
      providerShipmentId: 'PX-1',
      trackingCode: 'TRACK-1',
    });

    const service = new ShippingService(prisma as unknown as PrismaService, provider);

    await service.createProviderShipment(orderId, actorUserId);

    expect(prisma.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
          providerShipmentId: null,
        }),
        data: expect.objectContaining({
          providerCreationState: ShipmentProviderCreationState.IN_PROGRESS,
        }),
      }),
    );
    expect(provider.createShipment).toHaveBeenCalledTimes(1);
    expect(transaction.shipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerCreationState: ShipmentProviderCreationState.CREATED,
          providerShipmentId: 'PX-1',
          trackingCode: 'TRACK-1',
          status: ShipmentStatus.READY,
        }),
      }),
    );
  });

  it('does not create a duplicate provider shipment when an ID is already stored', async () => {
    const prisma = {
      shipment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: shipmentId,
            provider: 'postex',
            providerShipmentId: 'PX-1',
            providerCreationState: ShipmentProviderCreationState.CREATED,
            status: ShipmentStatus.READY,
            order: {
              status: OrderStatus.PROCESSING,
            },
          })
          .mockResolvedValueOnce({
            id: shipmentId,
            orderId,
          }),
      },
    };
    const service = new ShippingService(prisma as unknown as PrismaService, provider);

    await service.createProviderShipment(orderId, actorUserId);

    expect(provider.createShipment).not.toHaveBeenCalled();
  });
});
