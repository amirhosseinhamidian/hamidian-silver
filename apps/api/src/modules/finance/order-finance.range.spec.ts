import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { TOMAN_INT_MAX } from '../../common/toman';
import { OrderFinanceService } from './order-finance.service';

describe('OrderFinanceService PostgreSQL Int range', () => {
  it('rejects a finance snapshot amount that JavaScript can represent but PostgreSQL Int cannot', async () => {
    const transaction = {
      orderFinanceSnapshot: {
        createMany: jest.fn(),
      },
    };
    const service = new OrderFinanceService({} as PrismaService);

    await expect(
      service.createSnapshot(transaction as never, {
        orderId: '10000000-0000-4000-8000-000000000001',
        paidAt: new Date('2026-08-31T08:00:00.000Z'),
        merchandiseTotalToman: TOMAN_INT_MAX + 1,
        platingTotalToman: 0,
        discountTotalToman: 0,
        shippingTotalToman: 0,
        taxTotalToman: 0,
        grandTotalToman: TOMAN_INT_MAX + 1,
        items: [],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.orderFinanceSnapshot.createMany).not.toHaveBeenCalled();
  });
});
