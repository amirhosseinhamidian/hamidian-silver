import { BadRequestException, ConflictException } from '@nestjs/common';
import { INT32_MAX } from '../../common/int32';
import { TOMAN_INT_MAX } from '../../common/toman';
import {
  OrderStatus,
  PaymentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import { ShippingService } from './shipping.service';

describe('ShippingService provider boundary', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const shipmentId = '30000000-0000-4000-8000-000000000001';

  const shippingAddress = {
    recipientName: 'Test User',
    phone: '09120000000',
    province: 'Tehran',
    city: 'Tehran',
    addressLine: 'Test address',
    postalCode: '1234567890',
  };

  function quoteOrder() {
    return {
      id: orderId,
      orderNumber: 'HS-BOUNDARY',
      status: OrderStatus.PENDING_PAYMENT,
      merchandiseTotalToman: 1_000_000,
      platingTotalToman: 0,
      discountTotalToman: 0,
      taxTotalToman: 0,
      grandTotalToman: 1_000_000,
      shippingAddress,
      items: [
        {
          quantity: 1,
          unitWeightGrams: {
            toString: () => '5.000',
          },
        },
      ],
    };
  }

  it('rejects provider quote amounts outside the persisted Toman range', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue(quoteOrder()),
      },
    };
    const provider = {
      providerCode: 'postex',
      quote: jest.fn().mockResolvedValue([
        {
          serviceCode: 'STANDARD',
          costToman: TOMAN_INT_MAX + 1,
        },
      ]),
      createShipment: jest.fn(),
      track: jest.fn(),
    };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShippingProvider,
    );

    await expect(service.quoteOrder(userId, orderId)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects provider delivery estimates outside the PostgreSQL Int range', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue(quoteOrder()),
      },
    };
    const provider = {
      providerCode: 'postex',
      quote: jest.fn().mockResolvedValue([
        {
          serviceCode: 'STANDARD',
          costToman: 80_000,
          estimatedDeliveryDays: INT32_MAX + 1,
        },
      ]),
      createShipment: jest.fn(),
      track: jest.fn(),
    };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShippingProvider,
    );

    await expect(service.quoteOrder(userId, orderId)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks creation unknown when the provider returns invalid shipment identifiers', async () => {
    const baseShipment = {
      id: shipmentId,
      orderId,
      provider: 'postex',
      providerServiceCode: 'STANDARD',
      status: ShipmentStatus.PENDING,
      providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
      providerShipmentId: null,
      providerCreateError: null,
      creationAttemptedAt: null,
      shippingCostToman: 80_000,
      totalWeightGrams: {
        toString: () => '5.000',
      },
      order: {
        id: orderId,
        orderNumber: 'HS-BOUNDARY',
        status: OrderStatus.PAID,
        paidAt: new Date('2026-08-31T09:00:00.000Z'),
        payment: {
          status: PaymentStatus.PAID,
        },
        merchandiseTotalToman: 1_000_000,
        platingTotalToman: 0,
        discountTotalToman: 0,
        taxTotalToman: 0,
        grandTotalToman: 1_080_000,
        shippingAddress,
        platingFulfillment: null,
      },
    };
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(baseShipment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(),
    };
    const provider = {
      providerCode: 'postex',
      quote: jest.fn(),
      createShipment: jest.fn().mockResolvedValue({
        providerShipmentId: '   ',
      }),
      track: jest.fn(),
    };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShippingProvider,
    );

    await expect(service.createProviderShipment(orderId, userId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.shipment.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: shipmentId,
        providerCreationState: ShipmentProviderCreationState.IN_PROGRESS,
        providerShipmentId: null,
      },
      data: {
        providerCreationState: ShipmentProviderCreationState.UNKNOWN,
        providerCreateError: expect.any(String),
      },
    });
  });
});
