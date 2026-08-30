import { PaymentRefundStatus, SupplierPayableStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderFinanceService } from './order-finance.service';

describe('OrderFinanceService refund adjustments', () => {
  it('subtracts only confirmed refunds from collected revenue', async () => {
    const prisma = {
      orderFinanceSnapshot: {
        aggregate: jest.fn().mockResolvedValue({
          _count: {
            _all: 2,
          },
          _sum: {
            merchandiseRevenueToman: 2_000_000,
            platingRevenueToman: 0,
            discountToman: 0,
            shippingChargedToman: 100_000,
            taxToman: 0,
            customerTotalToman: 2_100_000,
            supplierCostToman: 1_000_000,
            grossSalesToman: 2_000_000,
            netSalesToman: 2_000_000,
            grossMarginBeforeServiceCostsToman: 1_000_000,
          },
        }),
      },
      supplierPayable: {
        groupBy: jest.fn().mockResolvedValue([
          {
            status: SupplierPayableStatus.OPEN,
            _sum: {
              amountToman: 1_000_000,
            },
            _count: {
              _all: 2,
            },
          },
        ]),
      },
      paymentRefund: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            amountToman: 300_000,
          },
          _count: {
            _all: 1,
          },
        }),
      },
    };
    const service = new OrderFinanceService(prisma as unknown as PrismaService);

    await expect(service.dashboard({})).resolves.toEqual(
      expect.objectContaining({
        customerTotalToman: 2_100_000,
        successfulRefundToman: 300_000,
        successfulRefundCount: 1,
        netCollectedRevenueToman: 1_800_000,
      }),
    );

    expect(prisma.paymentRefund.aggregate).toHaveBeenCalledWith({
      where: {
        status: PaymentRefundStatus.CONFIRMED,
        confirmedAt: undefined,
      },
      _sum: {
        amountToman: true,
      },
      _count: {
        _all: true,
      },
    });
  });
});
