import { BadRequestException } from '@nestjs/common';
import { SupplierPayableStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderFinanceService } from './order-finance.service';

describe('OrderFinanceService', () => {
  it('creates an immutable snapshot from paid-order values and supplier snapshots', async () => {
    const transaction = {
      orderFinanceSnapshot: {
        createMany: jest.fn().mockResolvedValue({
          count: 1,
        }),
      },
    };
    const service = new OrderFinanceService({} as PrismaService);

    await service.createSnapshot(transaction as never, {
      orderId: '10000000-0000-4000-8000-000000000001',
      paidAt: new Date('2026-08-30T12:00:00.000Z'),
      merchandiseTotalToman: 2_000_000,
      platingTotalToman: 200_000,
      discountTotalToman: 100_000,
      shippingTotalToman: 80_000,
      taxTotalToman: 20_000,
      grandTotalToman: 2_200_000,
      items: [
        {
          quantity: 2,
          unitSupplierPriceToman: 600_000,
        },
        {
          quantity: 1,
          unitSupplierPriceToman: null,
        },
      ],
    });

    expect(transaction.orderFinanceSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          merchandiseRevenueToman: 2_000_000,
          platingRevenueToman: 200_000,
          discountToman: 100_000,
          shippingChargedToman: 80_000,
          taxToman: 20_000,
          customerTotalToman: 2_200_000,
          supplierCostToman: 1_200_000,
          grossSalesToman: 2_200_000,
          netSalesToman: 2_100_000,
          grossMarginBeforeServiceCostsToman: 900_000,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('rejects an inconsistent grand total instead of snapshotting corrupted finance data', async () => {
    const transaction = {
      orderFinanceSnapshot: {
        createMany: jest.fn(),
      },
    };
    const service = new OrderFinanceService({} as PrismaService);

    await expect(
      service.createSnapshot(transaction as never, {
        orderId: '10000000-0000-4000-8000-000000000001',
        paidAt: new Date(),
        merchandiseTotalToman: 1_000_000,
        platingTotalToman: 0,
        discountTotalToman: 0,
        shippingTotalToman: 50_000,
        taxTotalToman: 0,
        grandTotalToman: 999_999,
        items: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.orderFinanceSnapshot.createMany).not.toHaveBeenCalled();
  });

  it('aggregates paid-order snapshots while reporting current payable liability separately', async () => {
    const prisma = {
      orderFinanceSnapshot: {
        aggregate: jest.fn().mockResolvedValue({
          _count: {
            _all: 3,
          },
          _sum: {
            merchandiseRevenueToman: 3_000_000,
            platingRevenueToman: 200_000,
            discountToman: 100_000,
            shippingChargedToman: 120_000,
            taxToman: 30_000,
            customerTotalToman: 3_250_000,
            supplierCostToman: 1_500_000,
            grossSalesToman: 3_200_000,
            netSalesToman: 3_100_000,
            grossMarginBeforeServiceCostsToman: 1_600_000,
          },
        }),
      },
      supplierPayable: {
        groupBy: jest.fn().mockResolvedValue([
          {
            status: SupplierPayableStatus.OPEN,
            _sum: {
              amountToman: 600_000,
            },
            _count: {
              _all: 2,
            },
          },
          {
            status: SupplierPayableStatus.PAID,
            _sum: {
              amountToman: 900_000,
            },
            _count: {
              _all: 4,
            },
          },
        ]),
      },
      paymentRefund: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            amountToman: 0,
          },
          _count: {
            _all: 0,
          },
        }),
      },
    };
    const service = new OrderFinanceService(prisma as unknown as PrismaService);

    await expect(service.dashboard({})).resolves.toEqual(
      expect.objectContaining({
        paidOrderCount: 3,
        customerTotalToman: 3_250_000,
        supplierCostToman: 1_500_000,
        grossProfitBeforeServiceCostsToman: 1_600_000,
        openSupplierPayablesToman: 600_000,
        openSupplierPayablesCount: 2,
        paidSupplierPayablesToman: 900_000,
        paidSupplierPayablesCount: 4,
      }),
    );
  });
});
