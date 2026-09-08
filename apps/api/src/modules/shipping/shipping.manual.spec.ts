import { ErrorCode } from '../../common/errors/error-codes';
import {
  OrderStatus,
  PaymentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import { ShippingService } from './shipping.service';

describe('ShippingService manual fulfillment', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const shipmentId = '30000000-0000-4000-8000-000000000001';
  const provider: jest.Mocked<ShippingProvider> = {
    providerCode: 'disabled',
    quote: jest.fn(),
    createShipment: jest.fn(),
    track: jest.fn(),
  };

  it('creates a ready internal shipment without calling a provider', async () => {
    const shipment = { id: shipmentId, orderId, status: ShipmentStatus.READY };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-MANUAL-1',
          status: OrderStatus.PAID,
          shippingTotalToman: 0,
          platingTotalToman: 0,
          payment: { status: PaymentStatus.PAID },
          shipment: null,
          shippingAddress: {
            recipientName: 'علی',
            phone: '09121234567',
            province: 'تهران',
            city: 'تهران',
            addressLine: 'نشانی',
            postalCode: '1234567890',
          },
          platingFulfillment: null,
          items: [{ quantity: 2, unitWeightGrams: { toString: () => '4.250' } }],
        }),
      },
      shipment: {
        create: jest.fn().mockResolvedValue(shipment),
        findUniqueOrThrow: jest.fn().mockResolvedValue(shipment),
      },
      shipmentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ShippingService(prisma as unknown as PrismaService, provider);
    await expect(
      service.createManualShipment(
        orderId,
        { serviceName: 'پست پیشتاز', estimatedDeliveryDays: 3, reason: 'بسته آماده است' },
        actorUserId,
      ),
    ).resolves.toEqual(shipment);
    expect(provider.createShipment).not.toHaveBeenCalled();
    expect(tx.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'manual',
        status: ShipmentStatus.READY,
        providerCreationState: ShipmentProviderCreationState.CREATED,
        shippingCostToman: 0,
        totalWeightGrams: '8.500',
      }),
    });
  });

  it('requires tracking before handing a manual shipment to the carrier', async () => {
    const tx = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue({
          id: shipmentId,
          orderId,
          provider: 'manual',
          status: ShipmentStatus.READY,
          trackingCode: null,
          providerCreationState: ShipmentProviderCreationState.CREATED,
          providerShipmentId: `manual:${orderId}`,
          providerCreateError: null,
          creationAttemptedAt: new Date(),
          order: {
            id: orderId,
            orderNumber: 'HS-MANUAL-1',
            status: OrderStatus.PROCESSING,
            paidAt: new Date(),
            deliveredAt: null,
            platingTotalToman: 0,
            payment: { status: PaymentStatus.PAID },
            platingFulfillment: null,
          },
        }),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ShippingService(prisma as unknown as PrismaService, provider);
    await expect(
      service.updateStatus(
        orderId,
        { status: ShipmentStatus.HANDED_OVER, reason: 'تحویل به پست' },
        actorUserId,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.SHIPMENT_NOT_READY });
  });
});
