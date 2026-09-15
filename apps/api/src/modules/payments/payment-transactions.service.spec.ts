import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PaymentAttemptStatus } from '../../generated/prisma/enums';
import { PaymentTransactionsService } from './payment-transactions.service';

describe('PaymentTransactionsService', () => {
  const prisma = {
    paymentAttempt: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const service = new PaymentTransactionsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.paymentAttempt.findMany.mockResolvedValue([]);
    prisma.paymentAttempt.count.mockResolvedValue(0);
    prisma.paymentAttempt.groupBy.mockResolvedValue([]);
    prisma.paymentAttempt.aggregate.mockResolvedValue({ _sum: { amountToman: null } });
  });

  it('returns a paginated finance-safe payment attempt projection', async () => {
    await expect(
      service.list({
        provider: 'zarinpal',
        status: PaymentAttemptStatus.FAILED,
        page: 2,
        pageSize: 25,
      }),
    ).resolves.toEqual({
      items: [],
      page: 2,
      pageSize: 25,
      total: 0,
      pageCount: 1,
      summary: { totalAmountToman: 0, byStatus: {}, byProvider: {} },
    });

    expect(prisma.paymentAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: 'zarinpal',
          status: PaymentAttemptStatus.FAILED,
        }),
        skip: 25,
        take: 25,
        select: expect.not.objectContaining({
          idempotencyKey: expect.anything(),
          paymentUrl: expect.anything(),
        }),
      }),
    );
  });

  it('searches gateway evidence, order number and customer identity', async () => {
    await service.list({ q: 'HS-1042' });

    expect(prisma.paymentAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ providerReference: expect.any(Object) }),
            expect.objectContaining({ payment: expect.any(Object) }),
          ]),
        }),
      }),
    );
  });
});
