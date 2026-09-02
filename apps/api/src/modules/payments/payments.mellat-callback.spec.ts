import type { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentAttemptStatus, PaymentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PAYMENT_GATEWAY_CODES } from './payment-gateway.constants';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService Mellat callback routing', () => {
  it('passes Mellat callback metadata and the attempt provider to the registry', async () => {
    const attemptId = '12345678-1234-4234-8234-123456789abc';
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          id: attemptId,
          provider: PAYMENT_GATEWAY_CODES.MELLAT,
          authority: 'REF123',
          amountToman: 1_200_000,
          status: PaymentAttemptStatus.REDIRECTED,
          providerReference: null,
          payment: {
            orderId: '20000000-0000-4000-8000-000000000001',
            status: PaymentStatus.PENDING,
            order: {
              status: OrderStatus.PENDING_PAYMENT,
            },
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const config = {
      get: jest.fn().mockReturnValue('https://api.example.com/api/v1/payments/callback'),
    };
    const registry: jest.Mocked<PaymentGateway> = {
      providerCode: 'registry',
      initiate: jest.fn(),
      verify: jest.fn().mockResolvedValue({
        success: false,
        code: 'TEST_STOP',
        message: 'Stop after routing assertion.',
      }),
    };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      registry,
    );
    const callbackData = {
      attemptId,
      resCode: '0',
      saleOrderId: '123',
      saleReferenceId: '456',
    };

    await expect(service.verifyCallback(attemptId, 'REF123', callbackData)).rejects.toThrow(
      'Payment verification failed.',
    );

    expect(registry.verify).toHaveBeenCalledWith({
      provider: PAYMENT_GATEWAY_CODES.MELLAT,
      authority: 'REF123',
      amountRial: '12000000',
      callbackData,
    });
  });
});
