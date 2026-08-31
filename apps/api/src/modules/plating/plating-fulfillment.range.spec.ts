import { BadRequestException } from '@nestjs/common';
import { TOMAN_INT_MAX } from '../../common/toman';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { OrderCostsService } from '../finance/order-costs.service';
import { PlatingFulfillmentService } from './plating-fulfillment.service';

describe('PlatingFulfillmentService Toman range', () => {
  it('rejects a direct completion amount that PostgreSQL Int cannot store', async () => {
    const prisma = {
      $transaction: jest.fn(),
    };
    const service = new PlatingFulfillmentService(
      prisma as unknown as PrismaService,
      {} as OrderCostsService,
    );

    await expect(
      service.complete(
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        {
          actualCostToman: TOMAN_INT_MAX + 1,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
