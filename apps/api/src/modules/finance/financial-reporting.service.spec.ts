import {
  PaymentRefundStatus,
  SupplierCreditStatus,
  SupplierPayableStatus,
  SupplierSettlementStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { FinancialReportingService } from './financial-reporting.service';

describe('FinancialReportingService', () => {
  it('builds a management dashboard from customer cash and supplier position ledgers', async () => {
    const prisma = {
      orderFinanceSnapshot: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 3 },
          _sum: {
            customerTotalToman: 3_000_000,
            grossMarginBeforeServiceCostsToman: 1_200_000,
          },
        }),
      },
      paymentRefund: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { amountToman: 300_000 },
        }),
      },
      supplierPayable: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _count: { _all: 4 },
            _sum: { amountToman: 1_600_000 },
          })
          .mockResolvedValueOnce({
            _count: { _all: 1 },
            _sum: { amountToman: 200_000 },
          }),
      },
      supplierCredit: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 2 },
          _sum: {
            amountToman: 700_000,
            appliedAmountToman: 200_000,
          },
        }),
      },
      supplierSettlement: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { creditAppliedToman: 150_000 },
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            totalAmountToman: 1_000_000,
            creditAppliedToman: 250_000,
            paidAmountToman: 750_000,
          },
        ]),
      },
    };
    const service = new FinancialReportingService(prisma as unknown as PrismaService);

    await expect(service.managementDashboard({})).resolves.toEqual(
      expect.objectContaining({
        paidOrderCount: 3,
        customerGrossCollectedToman: 3_000_000,
        confirmedRefundToman: 300_000,
        customerNetCollectedToman: 2_700_000,
        grossProfitBeforeServiceCostsToman: 1_200_000,
        supplierPosition: expect.objectContaining({
          openPayableToman: 1_600_000,
          availableCreditToman: 500_000,
          draftAppliedCreditToman: 150_000,
          creditOffsetToman: 650_000,
          netLiabilityToman: 950_000,
        }),
        supplierPayments: expect.objectContaining({
          settledGrossToman: 1_000_000,
          settledCreditToman: 250_000,
          settledCashPaidToman: 750_000,
          directCashPaidToman: 200_000,
          totalCashPaidToman: 950_000,
        }),
        netOperatingCashflowToman: 1_750_000,
      }),
    );

    expect(prisma.paymentRefund.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PaymentRefundStatus.CONFIRMED,
        }),
      }),
    );
    expect(prisma.supplierCredit.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: [SupplierCreditStatus.AVAILABLE, SupplierCreditStatus.PARTIALLY_APPLIED],
          },
        },
      }),
    );
  });

  it('includes direct supplier payments and legacy settlement cash fallback in cashflow', async () => {
    const prisma = {
      orderFinanceSnapshot: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 2 },
          _sum: { customerTotalToman: 2_000_000 },
        }),
      },
      paymentRefund: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { amountToman: 100_000 },
        }),
      },
      supplierSettlement: {
        findMany: jest.fn().mockResolvedValue([
          {
            totalAmountToman: 900_000,
            creditAppliedToman: 200_000,
            paidAmountToman: null,
          },
        ]),
      },
      supplierPayable: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { amountToman: 150_000 },
        }),
      },
    };
    const service = new FinancialReportingService(prisma as unknown as PrismaService);

    await expect(service.cashflow({})).resolves.toEqual(
      expect.objectContaining({
        customerCashInToman: 2_000_000,
        customerRefundCashOutToman: 100_000,
        supplierSettlementGrossToman: 900_000,
        supplierSettlementCreditToman: 200_000,
        supplierSettlementCashOutToman: 700_000,
        supplierDirectCashOutToman: 150_000,
        supplierCashOutToman: 850_000,
        netOperatingCashflowToman: 1_050_000,
      }),
    );

    expect(prisma.supplierPayable.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: SupplierPayableStatus.PAID,
          settlementId: null,
        }),
      }),
    );
  });

  it('reconciles current supplier liability with available and draft-applied credits', async () => {
    const supplierId = '10000000-0000-4000-8000-000000000001';
    const prisma = {
      supplierPayable: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([
            {
              supplierIdSnapshot: supplierId,
              supplierNameSnapshot: 'Supplier A',
              _count: { _all: 2 },
              _sum: { amountToman: 1_000_000 },
              _max: { createdAt: new Date('2026-08-01T00:00:00.000Z') },
            },
          ])
          .mockResolvedValueOnce([
            {
              supplierIdSnapshot: supplierId,
              supplierNameSnapshot: 'Supplier A',
              _count: { _all: 1 },
              _sum: { amountToman: 100_000 },
              _max: {
                paidAt: new Date('2026-08-20T00:00:00.000Z'),
                createdAt: new Date('2026-08-10T00:00:00.000Z'),
              },
            },
          ]),
      },
      supplierCredit: {
        groupBy: jest.fn().mockResolvedValue([
          {
            supplierIdSnapshot: supplierId,
            supplierNameSnapshot: 'Supplier A',
            _count: { _all: 1 },
            _sum: {
              amountToman: 500_000,
              appliedAmountToman: 100_000,
            },
            _max: { createdAt: new Date('2026-08-15T00:00:00.000Z') },
          },
        ]),
      },
      supplierSettlement: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              supplierIdSnapshot: supplierId,
              supplierNameSnapshot: 'Supplier A',
              creditAppliedToman: 200_000,
              createdAt: new Date('2026-08-18T00:00:00.000Z'),
            },
          ])
          .mockResolvedValueOnce([
            {
              supplierIdSnapshot: supplierId,
              supplierNameSnapshot: 'Supplier A',
              totalAmountToman: 600_000,
              creditAppliedToman: 150_000,
              paidAmountToman: 450_000,
              paidAt: new Date('2026-08-25T00:00:00.000Z'),
              createdAt: new Date('2026-08-22T00:00:00.000Z'),
            },
          ]),
      },
    };
    const service = new FinancialReportingService(prisma as unknown as PrismaService);

    const result = await service.suppliers({});

    expect(result.suppliers).toEqual([
      expect.objectContaining({
        supplierId,
        openPayableToman: 1_000_000,
        availableCreditToman: 400_000,
        draftAppliedCreditToman: 200_000,
        creditOffsetToman: 600_000,
        netLiabilityToman: 400_000,
        settledGrossToman: 600_000,
        settledCreditToman: 150_000,
        settledCashPaidToman: 450_000,
        directCashPaidToman: 100_000,
        totalSupplierCashPaidToman: 550_000,
      }),
    ]);

    expect(prisma.supplierSettlement.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          status: SupplierSettlementStatus.DRAFT,
          creditAppliedToman: {
            gt: 0,
          },
        },
      }),
    );
  });
});
