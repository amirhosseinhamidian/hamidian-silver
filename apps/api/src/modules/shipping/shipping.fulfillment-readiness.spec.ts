import { ConflictException } from '@nestjs/common';
import {
  OrderStatus,
  PlatingFulfillmentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import { ShippingService } from './shipping.service';

describe('ShippingService fulfillment readiness gate', () => {
  const orderId = '10000000-0000-4000-8000-000000000001';

  it('does not contact the provider before required plating is completed', async () => {
    const provider = {
      providerCode: 'postex',
      createShipment: jest.fn(),
    };
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue({
          id: '20000000-0000-4000-8000-000000000001',
          orderId,
          provider: 'postex',
          providerServiceCode: 'POST|STANDARD',
          status: ShipmentStatus.PENDING,
          providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
          providerShipmentId: null,
          providerCreateError: null,
          creationAttemptedAt: null,
          shippingCostToman: 90_000,
          totalWeightGrams: {
            toString: () => '10.000',
          },
          order: {
            id: orderId,
            orderNumber: 'HS-049',
            status: OrderStatus.PROCESSING,
            paidAt: new Date('2026-08-30T12:00:00.000Z'),
            merchandiseTotalToman: 1_000_000,
            platingTotalToman: 200_000,
            discountTotalToman: 0,
            taxTotalToman: 0,
            grandTotalToman: 1_290_000,
            shippingAddress: {
              recipientName: 'Test User',
              phone: '09120000000',
              province: 'Tehran',
              city: 'Tehran',
              addressLine: 'Test address',
              postalCode: '1234567890',
            },
            platingFulfillment: {
              status: PlatingFulfillmentStatus.IN_PROGRESS,
            },
          },
        }),
      },
    };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShippingProvider,
      undefined,
      undefined,
    );

    await expect(
      service.createProviderShipment(orderId, '30000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(provider.createShipment).not.toHaveBeenCalled();
  });
});
