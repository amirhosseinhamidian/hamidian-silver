import {
  OrderStatus,
  PaymentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import type { ShippingCarriersService } from './shipping-carriers.service';
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
        { serviceName: 'پست پیشتاز', estimatedDeliveryDays: 3 },
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
    expect(tx.shipmentStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: null }),
    });

    const shippingCarriers = {
      snapshotActive: jest.fn().mockResolvedValue({
        serviceName: 'ماهکس',
        snapshot: {
          carrierNameSnapshot: 'ماهکس',
          carrierTrackingUrlSnapshot: 'https://mahex.com/tracking',
          carrierLogoMediaIdSnapshot: null,
          carrierPresentationSnapshottedAt: new Date('2026-09-15T00:00:00.000Z'),
        },
      }),
    };
    const configuredCarrierService = new ShippingService(
      prisma as unknown as PrismaService,
      provider,
      undefined,
      undefined,
      undefined,
      shippingCarriers as unknown as ShippingCarriersService,
    );
    await configuredCarrierService.createManualShipment(
      orderId,
      {
        carrierId: '40000000-0000-4000-8000-000000000001',
        estimatedDeliveryDays: 3,
        reason: 'بسته آماده است',
      },
      actorUserId,
    );
    expect(shippingCarriers.snapshotActive).toHaveBeenCalledWith(
      '40000000-0000-4000-8000-000000000001',
      tx,
    );
    expect(tx.shipment.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        providerServiceName: 'ماهکس',
        carrierNameSnapshot: 'ماهکس',
        carrierTrackingUrlSnapshot: 'https://mahex.com/tracking',
      }),
    });
  });

  it('uses the immutable carrier selected at checkout even after carrier settings change', async () => {
    const selectedCarrierId = '40000000-0000-4000-8000-000000000001';
    const shipment = { id: shipmentId, orderId, status: ShipmentStatus.READY };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-CARRIER-1',
          status: OrderStatus.PAID,
          shippingTotalToman: 80_000,
          shippingCarrierIdSnapshot: selectedCarrierId,
          shippingCarrierNameSnapshot: 'پست پیشتاز',
          shippingCarrierTrackingUrlSnapshot: 'https://tracking.example/',
          shippingCarrierLogoMediaIdSnapshot: null,
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
          items: [{ quantity: 1, unitWeightGrams: { toString: () => '4.250' } }],
        }),
      },
      shipment: {
        create: jest.fn().mockResolvedValue(shipment),
        findUniqueOrThrow: jest.fn().mockResolvedValue(shipment),
      },
      shipmentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const shippingCarriers = { snapshotActive: jest.fn() };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider,
      undefined,
      undefined,
      undefined,
      shippingCarriers as unknown as ShippingCarriersService,
    );

    await service.createManualShipment(
      orderId,
      {
        carrierId: selectedCarrierId,
        estimatedDeliveryDays: 3,
        reason: 'ارسال طبق انتخاب مشتری',
      },
      actorUserId,
    );

    expect(shippingCarriers.snapshotActive).not.toHaveBeenCalled();
    expect(tx.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerServiceName: 'پست پیشتاز',
        shippingCostToman: 80_000,
        carrierNameSnapshot: 'پست پیشتاز',
        carrierTrackingUrlSnapshot: 'https://tracking.example/',
      }),
    });
  });

  it('hands a postal shipment over without requiring a tracking code', async () => {
    const current = {
      id: shipmentId,
      orderId,
      provider: 'manual',
      status: ShipmentStatus.READY,
      trackingCode: null,
      deliveryTypeSnapshot: 'POST',
      providerCreationState: ShipmentProviderCreationState.CREATED,
      providerShipmentId: `manual:${orderId}`,
      providerCreateError: null,
      creationAttemptedAt: new Date(),
      shippedAt: null,
      deliveredAt: null,
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
    };
    const updated = { ...current, status: ShipmentStatus.HANDED_OVER };
    const tx = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      },
      shipmentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ShippingService(prisma as unknown as PrismaService, provider);

    await expect(
      service.updateStatus(orderId, { status: ShipmentStatus.HANDED_OVER }, actorUserId),
    ).resolves.toEqual(updated);
    expect(tx.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ trackingCode: undefined }) }),
    );
  });

  it('hands a courier shipment over without requiring a postal tracking code', async () => {
    const current = {
      id: shipmentId,
      orderId,
      provider: 'manual',
      status: ShipmentStatus.READY,
      trackingCode: null,
      deliveryTypeSnapshot: 'COURIER',
      providerCreationState: ShipmentProviderCreationState.CREATED,
      providerShipmentId: `manual:${orderId}`,
      providerCreateError: null,
      creationAttemptedAt: new Date(),
      shippedAt: null,
      deliveredAt: null,
      order: {
        id: orderId,
        orderNumber: 'HS-COURIER-1',
        status: OrderStatus.PROCESSING,
        paidAt: new Date(),
        deliveredAt: null,
        platingTotalToman: 0,
        payment: { status: PaymentStatus.PAID },
        platingFulfillment: null,
      },
    };
    const updated = { ...current, status: ShipmentStatus.HANDED_OVER };
    const tx = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      },
      shipmentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ShippingService(prisma as unknown as PrismaService, provider);

    await expect(
      service.updateStatus(
        orderId,
        { status: ShipmentStatus.HANDED_OVER, reason: 'تحویل به پیک' },
        actorUserId,
      ),
    ).resolves.toEqual(updated);
    expect(tx.shipment.updateMany).toHaveBeenCalled();
  });
});
