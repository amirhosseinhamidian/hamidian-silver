import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import { ShippingService } from './shipping.service';

describe('ShippingService customer projection security', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';

  const prisma = {
    shipment: {
      findFirst: jest.fn(),
    },
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
    prisma.shipment.findFirst.mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000001',
    });
    service = new ShippingService(prisma as unknown as PrismaService, provider);
  });

  it('scopes customer shipment lookup and excludes provider recovery internals', async () => {
    await service.getMyShipment(userId, orderId);

    const query = prisma.shipment.findFirst.mock.calls[0]?.[0];
    expect(query.where).toEqual({
      orderId,
      order: {
        userId,
      },
    });
    expect(query.select).not.toHaveProperty('providerShipmentId');
    expect(query.select).not.toHaveProperty('providerCreationState');
    expect(query.select).not.toHaveProperty('providerCreateError');
    expect(query.select).not.toHaveProperty('lastProviderStatus');
    expect(query.select).not.toHaveProperty('lastProviderDescription');
    expect(query.select).not.toHaveProperty('trackingAttemptedAt');
    expect(query.select).not.toHaveProperty('trackingSyncToken');
    expect(query.select).not.toHaveProperty('trackingSyncStartedAt');
    expect(query.select.statusHistory.select).toEqual({
      fromStatus: true,
      toStatus: true,
      createdAt: true,
    });
  });
});
