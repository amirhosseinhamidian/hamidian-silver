import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentReconciliationStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PAYMENT_GATEWAY_CODES } from './payment-gateway.constants';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService reconciliation safety', () => {
  const attemptId = '10000000-0000-4000-8000-000000000001';
  const paymentId = '20000000-0000-4000-8000-000000000001';
  const orderId = '30000000-0000-4000-8000-000000000001';

  const config = {
    get: jest.fn().mockReturnValue('https://api.example.com/api/v1/payments/callback'),
  };

  const gateway: jest.Mocked<PaymentGateway> = {
    providerCode: 'registry',
    initiate: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records reconciliation when the gateway verifies after the order expired', async () => {
    const callbackAttempt = {
      id: attemptId,
      paymentId,
      provider: PAYMENT_GATEWAY_CODES.ZARINPAL,
      authority: 'AUTH-1',
      providerReference: null,
      amountToman: 1_000_000,
      verifiedAt: null,
      status: PaymentAttemptStatus.REDIRECTED,
      payment: {
        orderId,
        status: PaymentStatus.CANCELLED,
        order: {
          status: OrderStatus.EXPIRED,
        },
      },
    };
    const finalAttempt = {
      ...callbackAttempt,
      reconciliation: null,
      payment: {
        ...callbackAttempt.payment,
        order: {
          id: orderId,
          status: OrderStatus.EXPIRED,
          items: [],
        },
      },
    };
    const reconciliationAttempt = {
      ...callbackAttempt,
      reconciliation: null,
      payment: {
        ...callbackAttempt.payment,
        order: {
          id: orderId,
          status: OrderStatus.EXPIRED,
        },
      },
    };
    const transaction = {
      paymentAttempt: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(finalAttempt)
          .mockResolvedValueOnce(reconciliationAttempt),
        update: jest.fn().mockResolvedValue({}),
      },
      payment: {
        update: jest.fn().mockResolvedValue({}),
      },
      paymentReconciliation: {
        upsert: jest.fn().mockResolvedValue({
          id: '40000000-0000-4000-8000-000000000001',
          status: PaymentReconciliationStatus.OPEN,
        }),
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

    gateway.verify.mockResolvedValue({
      success: true,
      referenceId: 'REF-1',
    });

    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      gateway,
    );

    await expect(service.verifyCallback(attemptId, 'AUTH-1')).resolves.toEqual({
      success: true,
      reconciliationRequired: true,
      reconciliationId: '40000000-0000-4000-8000-000000000001',
      orderId,
      referenceId: 'REF-1',
    });

    expect(transaction.paymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: attemptId,
        },
        data: expect.objectContaining({
          status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
          providerReference: 'REF-1',
        }),
      }),
    );
    expect(transaction.payment.update).toHaveBeenCalledWith({
      where: {
        id: paymentId,
      },
      data: {
        status: PaymentStatus.RECONCILIATION_REQUIRED,
      },
    });
  });

  it('records reconciliation after a domain finalization conflict', async () => {
    const callbackAttempt = {
      id: attemptId,
      paymentId,
      provider: PAYMENT_GATEWAY_CODES.ZIBAL,
      authority: '12345',
      providerReference: null,
      amountToman: 1_000_000,
      verifiedAt: null,
      status: PaymentAttemptStatus.REDIRECTED,
      payment: {
        orderId,
        status: PaymentStatus.PENDING,
        order: {
          status: OrderStatus.PENDING_PAYMENT,
        },
      },
    };
    const reconciliationAttempt = {
      ...callbackAttempt,
      reconciliation: null,
      payment: {
        ...callbackAttempt.payment,
        order: {
          id: orderId,
          status: OrderStatus.PENDING_PAYMENT,
        },
      },
    };
    const recordTransaction = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(reconciliationAttempt),
        update: jest.fn().mockResolvedValue({}),
      },
      payment: {
        update: jest.fn().mockResolvedValue({}),
      },
      paymentReconciliation: {
        upsert: jest.fn().mockResolvedValue({
          id: '40000000-0000-4000-8000-000000000001',
        }),
      },
    };
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(callbackAttempt),
        updateMany: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockRejectedValueOnce(new ConflictException('Reserved inventory is inconsistent.'))
        .mockImplementationOnce(
          async (callback: (client: typeof recordTransaction) => Promise<unknown>) =>
            callback(recordTransaction),
        ),
    };

    gateway.verify.mockResolvedValue({
      success: true,
      referenceId: 'REF-2',
    });

    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      gateway,
    );

    await expect(service.verifyCallback(attemptId, '12345')).resolves.toEqual(
      expect.objectContaining({
        reconciliationRequired: true,
        referenceId: 'REF-2',
      }),
    );
  });
});
