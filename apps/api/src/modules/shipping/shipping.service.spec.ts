import { ErrorCode } from '../../common/errors/error-codes';
import { OrderStatus, ShipmentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import { ShippingService } from './shipping.service';

describe('ShippingService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const shipmentId = '30000000-0000-4000-8000-000000000001';

  const shippingAddress = {
    recipientName: 'Test Customer',
    phone: '+989123456789',
    province: 'Tehran',
    city: 'Tehran',
    addressLine: 'Test address',
    postalCode: '1234567890',
  };

  const order = {
    id: orderId,
    orderNumber: 'HS-TEST',
    status: OrderStatus.PENDING_PAYMENT,
    merchandiseTotalToman: 1_000_000,
    platingTotalToman: 100_000,
    discountTotalToman: 50_000,
    taxTotalToman: 0,
    grandTotalToman: 1_050_000,
    shippingAddress,
    items: [
      {
        quantity: 2,
        unitWeightGrams: {
          toString: () => '4.250',
        },
      },
      {
        quantity: 1,
        unitWeightGrams: {
          toString: () => '2.000',
        },
      },
    ],
  };

  const prisma = {
    order: {
      findFirst: jest.fn(),
    },
    shipment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const provider: jest.Mocked<ShippingProvider> = {
    providerCode: 'test-shipping',
    quote: jest.fn(),
    createShipment: jest.fn(),
    track: jest.fn(),
  };

  let service: ShippingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.order.findFirst.mockResolvedValue(order);
    service = new ShippingService(prisma as unknown as PrismaService, provider);
  });

  it('quotes shipping from immutable order-item weight snapshots', async () => {
    provider.quote.mockResolvedValue([
      {
        serviceCode: 'EXPRESS',
        serviceName: 'Express',
        costToman: 120_000,
        estimatedDeliveryDays: 2,
      },
    ]);

    await expect(service.quoteOrder(userId, orderId)).resolves.toEqual({
      provider: 'test-shipping',
      totalWeightGrams: '10.500',
      options: [
        {
          serviceCode: 'EXPRESS',
          serviceName: 'Express',
          costToman: 120_000,
          estimatedDeliveryDays: 2,
        },
      ],
    });

    expect(provider.quote).toHaveBeenCalledWith({
      orderNumber: 'HS-TEST',
      totalWeightGrams: '10.500',
      declaredValueToman: 1_050_000,
      destination: shippingAddress,
    });
  });

  it('selects a provider rate and adds shipping to the order grand total', async () => {
    provider.quote.mockResolvedValue([
      {
        serviceCode: 'EXPRESS',
        serviceName: 'Express',
        costToman: 120_000,
        estimatedDeliveryDays: 2,
      },
    ]);

    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          userId,
          status: OrderStatus.PENDING_PAYMENT,
          merchandiseTotalToman: 1_000_000,
          platingTotalToman: 100_000,
          discountTotalToman: 50_000,
          taxTotalToman: 0,
          payment: null,
          shipment: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      shipment: {
        upsert: jest.fn().mockResolvedValue({
          id: shipmentId,
          orderId,
          status: ShipmentStatus.PENDING,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: shipmentId,
          orderId,
          shippingCostToman: 120_000,
        }),
      },
      shipmentStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.selectRate(userId, orderId, {
      serviceCode: 'EXPRESS',
    });

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.order.findFirst.mock.invocationCallOrder[0],
    );

    expect(transaction.shipment.upsert).toHaveBeenCalledWith({
      where: {
        orderId,
      },
      update: {
        provider: 'test-shipping',
        providerServiceCode: 'EXPRESS',
        providerServiceName: 'Express',
        shippingCostToman: 120_000,
        totalWeightGrams: '10.500',
        estimatedDeliveryDays: 2,
      },
      create: {
        orderId,
        provider: 'test-shipping',
        providerServiceCode: 'EXPRESS',
        providerServiceName: 'Express',
        shippingCostToman: 120_000,
        totalWeightGrams: '10.500',
        estimatedDeliveryDays: 2,
      },
    });

    expect(transaction.order.update).toHaveBeenCalledWith({
      where: {
        id: orderId,
      },
      data: {
        shippingTotalToman: 120_000,
        grandTotalToman: 1_170_000,
      },
    });

    expect(transaction.shipmentStatusHistory.create).toHaveBeenCalledWith({
      data: {
        shipmentId,
        actorUserId: userId,
        fromStatus: null,
        toStatus: ShipmentStatus.PENDING,
        reason: 'Shipping service selected',
      },
    });
  });

  it('does not allow shipping to change after payment initialization', async () => {
    provider.quote.mockResolvedValue([
      {
        serviceCode: 'EXPRESS',
        costToman: 120_000,
      },
    ]);

    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          userId,
          status: OrderStatus.PENDING_PAYMENT,
          merchandiseTotalToman: 1_000_000,
          platingTotalToman: 100_000,
          discountTotalToman: 0,
          taxTotalToman: 0,
          payment: {
            id: '40000000-0000-4000-8000-000000000001',
          },
          shipment: null,
        }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.selectRate(userId, orderId, {
        serviceCode: 'EXPRESS',
      }),
    ).rejects.toMatchObject({
      name: 'DomainException',
      code: ErrorCode.SHIPMENT_INVALID_STATUS,
    });
  });

  it('rejects shipping quotes when an order item has no weight snapshot', async () => {
    prisma.order.findFirst.mockResolvedValue({
      ...order,
      items: [
        {
          quantity: 1,
          unitWeightGrams: null,
        },
      ],
    });

    await expect(service.quoteOrder(userId, orderId)).rejects.toMatchObject({
      name: 'DomainException',
      code: ErrorCode.SHIPMENT_NOT_READY,
    });

    expect(provider.quote).not.toHaveBeenCalled();
  });

  it('enforces shipment status transitions', async () => {
    const transaction = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue({
          id: shipmentId,
          orderId,
          status: ShipmentStatus.PENDING,
          shippedAt: null,
          deliveredAt: null,
        }),
        update: jest.fn(),
      },
      shipmentStatusHistory: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.updateStatus(
        orderId,
        {
          status: ShipmentStatus.DELIVERED,
        },
        userId,
      ),
    ).rejects.toMatchObject({
      name: 'DomainException',
      code: ErrorCode.SHIPMENT_INVALID_STATUS,
    });

    expect(transaction.shipment.update).not.toHaveBeenCalled();
  });
});
