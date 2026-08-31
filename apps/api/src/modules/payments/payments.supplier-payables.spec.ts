import type { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentAttemptStatus, PaymentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService supplier payables', () => {
  it('creates one payable per supplier-backed order item after payment verification', async () => {
    const attemptId = '10000000-0000-4000-8000-000000000001';
    const paymentId = '20000000-0000-4000-8000-000000000001';
    const orderId = '30000000-0000-4000-8000-000000000001';
    const warehouseId = '40000000-0000-4000-8000-000000000001';
    const itemId = '50000000-0000-4000-8000-000000000001';
    const supplierId = '60000000-0000-4000-8000-000000000001';
    const variantId = '70000000-0000-4000-8000-000000000001';

    const callbackAttempt = {
      id: attemptId,
      paymentId,
      provider: 'zarinpal',
      authority: 'AUTH-1',
      providerReference: null,
      amountToman: 1_000_000,
      status: PaymentAttemptStatus.REDIRECTED,
      payment: {
        orderId,
        amountToman: 1_000_000,
        status: PaymentStatus.PENDING,
        order: {
          id: orderId,
          grandTotalToman: 1_000_000,
          status: OrderStatus.PENDING_PAYMENT,
        },
      },
    };
    const transactionAttempt = {
      ...callbackAttempt,
      payment: {
        ...callbackAttempt.payment,
        order: {
          id: orderId,
          warehouseId,
          grandTotalToman: 1_000_000,
          status: OrderStatus.PENDING_PAYMENT,
          items: [
            {
              id: itemId,
              variantId,
              quantity: 2,
              unitSupplierPriceToman: 300_000,
              supplierIdSnapshot: supplierId,
              supplierNameSnapshot: 'Supplier A',
            },
          ],
        },
      },
    };
    const transaction = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(transactionAttempt),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: '80000000-0000-4000-8000-000000000001',
          onHand: 10,
          reserved: 2,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      supplierPayable: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(callbackAttempt),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const config = {
      get: jest.fn().mockReturnValue('https://api.example.com/api/v1/payments/callback'),
    };
    const gateway: jest.Mocked<PaymentGateway> = {
      providerCode: 'registry',
      initiate: jest.fn(),
      verify: jest.fn().mockResolvedValue({
        success: true,
        referenceId: 'REF-1',
      }),
    };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      gateway,
    );

    await service.verifyCallback(attemptId, 'AUTH-1');

    expect(transaction.supplierPayable.createMany).toHaveBeenCalledWith({
      data: [
        {
          orderId,
          orderItemId: itemId,
          supplierIdSnapshot: supplierId,
          supplierNameSnapshot: 'Supplier A',
          quantity: 2,
          unitSupplierPriceToman: 300_000,
          amountToman: 600_000,
        },
      ],
      skipDuplicates: true,
    });
  });
});
