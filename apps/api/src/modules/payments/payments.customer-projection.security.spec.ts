import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService customer projection security', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';

  const prisma = {
    payment: {
      findFirst: jest.fn(),
    },
    paymentAttempt: {
      findFirst: jest.fn(),
    },
  };
  const config = {
    get: jest.fn().mockReturnValue('https://api.example.com/api/v1/payments/callback'),
  };
  const gateway: jest.Mocked<PaymentGateway> = {
    providerCode: 'test',
    initiate: jest.fn(),
    verify: jest.fn(),
  };

  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payment.findFirst.mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000001',
    });
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      gateway,
    );
  });

  it('keeps ownership scope while excluding gateway and refund-internal identifiers', async () => {
    await service.getOrderPayment(userId, orderId);

    const query = prisma.payment.findFirst.mock.calls[0]?.[0];
    expect(query.where).toEqual({
      orderId,
      order: {
        userId,
      },
    });
    expect(query.select).not.toHaveProperty('refundAllocatedToman');
    expect(query.select.attempts.select).not.toHaveProperty('authority');
    expect(query.select.refunds.select).not.toHaveProperty('externalReference');
    expect(query.select.attempts.select.providerReference).toBe(true);
  });

  it('scopes receipt access to an order owned by the authenticated customer', async () => {
    prisma.paymentAttempt.findFirst.mockResolvedValue({
      receiptData: Uint8Array.from([1, 2, 3]),
      receiptMimeType: 'image/png',
      receiptOriginalName: 'receipt.png',
    });

    await service.getCustomerCardToCardReceipt(userId, orderId);

    const query = prisma.paymentAttempt.findFirst.mock.calls[0]?.[0];
    expect(query.where).toEqual({
      provider: 'card_to_card',
      receiptData: { not: null },
      payment: {
        order: { id: orderId, userId },
      },
    });
    expect(query.select).toEqual({
      receiptData: true,
      receiptMimeType: true,
      receiptOriginalName: true,
    });
  });
});
