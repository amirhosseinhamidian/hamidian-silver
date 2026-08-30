import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  PaymentRefundStatus,
  SupplierCreditStatus,
  SupplierPayableStatus,
  SupplierSettlementStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FinancePeriodQueryDto } from './dto/finance-period-query.dto';

type SupplierReportingRow = {
  supplierId: string;
  supplierName: string;
  latestNameAt: Date;
  openPayableToman: number;
  openPayableCount: number;
  availableCreditToman: number;
  availableCreditCount: number;
  draftAppliedCreditToman: number;
  settledGrossToman: number;
  settledCreditToman: number;
  settledCashPaidToman: number;
  settlementCount: number;
  directCashPaidToman: number;
  directPayableCount: number;
};

@Injectable()
export class FinancialReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async managementDashboard(query: FinancePeriodQueryDto) {
    const period = this.buildDateTimeFilter(query.from, query.to);
    const [
      finance,
      refunds,
      openPayables,
      availableCredits,
      draftSettlements,
      paidSettlements,
      directSupplierPayments,
    ] = await Promise.all([
      this.prisma.orderFinanceSnapshot.aggregate({
        where: period ? { paidAt: period } : {},
        _count: {
          _all: true,
        },
        _sum: {
          customerTotalToman: true,
          grossMarginBeforeServiceCostsToman: true,
        },
      }),
      this.prisma.paymentRefund.aggregate({
        where: {
          status: PaymentRefundStatus.CONFIRMED,
          confirmedAt: period,
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountToman: true,
        },
      }),
      this.prisma.supplierPayable.aggregate({
        where: {
          status: SupplierPayableStatus.OPEN,
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountToman: true,
        },
      }),
      this.prisma.supplierCredit.aggregate({
        where: {
          status: {
            in: [SupplierCreditStatus.AVAILABLE, SupplierCreditStatus.PARTIALLY_APPLIED],
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountToman: true,
          appliedAmountToman: true,
        },
      }),
      this.prisma.supplierSettlement.aggregate({
        where: {
          status: SupplierSettlementStatus.DRAFT,
        },
        _count: {
          _all: true,
        },
        _sum: {
          creditAppliedToman: true,
        },
      }),
      this.prisma.supplierSettlement.findMany({
        where: {
          status: SupplierSettlementStatus.PAID,
          paidAt: period,
        },
        select: {
          totalAmountToman: true,
          creditAppliedToman: true,
          paidAmountToman: true,
        },
      }),
      this.prisma.supplierPayable.aggregate({
        where: {
          status: SupplierPayableStatus.PAID,
          settlementId: null,
          paidAt: period,
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountToman: true,
        },
      }),
    ]);

    const settlementTotals = this.reducePaidSettlements(paidSettlements);
    const customerGrossCollectedToman = finance._sum.customerTotalToman ?? 0;
    const confirmedRefundToman = refunds._sum.amountToman ?? 0;
    const supplierOpenPayableToman = openPayables._sum.amountToman ?? 0;
    const supplierAvailableCreditToman =
      (availableCredits._sum.amountToman ?? 0) - (availableCredits._sum.appliedAmountToman ?? 0);
    const supplierDraftAppliedCreditToman = draftSettlements._sum.creditAppliedToman ?? 0;
    const supplierCreditOffsetToman =
      supplierAvailableCreditToman + supplierDraftAppliedCreditToman;
    const supplierDirectCashPaidToman = directSupplierPayments._sum.amountToman ?? 0;
    const supplierCashPaidToman = settlementTotals.cashPaidToman + supplierDirectCashPaidToman;

    return {
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      paidOrderCount: finance._count._all,
      customerGrossCollectedToman,
      confirmedRefundToman,
      confirmedRefundCount: refunds._count._all,
      customerNetCollectedToman: customerGrossCollectedToman - confirmedRefundToman,
      grossProfitBeforeServiceCostsToman: finance._sum.grossMarginBeforeServiceCostsToman ?? 0,
      supplierPosition: {
        scope: 'CURRENT',
        openPayableToman: supplierOpenPayableToman,
        openPayableCount: openPayables._count._all,
        availableCreditToman: supplierAvailableCreditToman,
        availableCreditCount: availableCredits._count._all,
        draftAppliedCreditToman: supplierDraftAppliedCreditToman,
        draftSettlementCount: draftSettlements._count._all,
        creditOffsetToman: supplierCreditOffsetToman,
        netLiabilityToman: supplierOpenPayableToman - supplierCreditOffsetToman,
      },
      supplierPayments: {
        scope: 'PERIOD',
        settledGrossToman: settlementTotals.grossToman,
        settledCreditToman: settlementTotals.creditToman,
        settledCashPaidToman: settlementTotals.cashPaidToman,
        settlementCount: settlementTotals.count,
        directCashPaidToman: supplierDirectCashPaidToman,
        directPayableCount: directSupplierPayments._count._all,
        totalCashPaidToman: supplierCashPaidToman,
      },
      netOperatingCashflowToman:
        customerGrossCollectedToman - confirmedRefundToman - supplierCashPaidToman,
    };
  }

  async cashflow(query: FinancePeriodQueryDto) {
    const period = this.buildDateTimeFilter(query.from, query.to);
    const [customerCashIn, refunds, settlements, directSupplierPayments] = await Promise.all([
      this.prisma.orderFinanceSnapshot.aggregate({
        where: period ? { paidAt: period } : {},
        _count: {
          _all: true,
        },
        _sum: {
          customerTotalToman: true,
        },
      }),
      this.prisma.paymentRefund.aggregate({
        where: {
          status: PaymentRefundStatus.CONFIRMED,
          confirmedAt: period,
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountToman: true,
        },
      }),
      this.prisma.supplierSettlement.findMany({
        where: {
          status: SupplierSettlementStatus.PAID,
          paidAt: period,
        },
        select: {
          totalAmountToman: true,
          creditAppliedToman: true,
          paidAmountToman: true,
        },
      }),
      this.prisma.supplierPayable.aggregate({
        where: {
          status: SupplierPayableStatus.PAID,
          settlementId: null,
          paidAt: period,
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountToman: true,
        },
      }),
    ]);

    const settlementTotals = this.reducePaidSettlements(settlements);
    const customerCashInToman = customerCashIn._sum.customerTotalToman ?? 0;
    const customerRefundCashOutToman = refunds._sum.amountToman ?? 0;
    const supplierSettlementCashOutToman = settlementTotals.cashPaidToman;
    const supplierDirectCashOutToman = directSupplierPayments._sum.amountToman ?? 0;
    const supplierCashOutToman = supplierSettlementCashOutToman + supplierDirectCashOutToman;

    return {
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      customerCashInToman,
      customerCashInOrderCount: customerCashIn._count._all,
      customerRefundCashOutToman,
      customerRefundCount: refunds._count._all,
      supplierSettlementGrossToman: settlementTotals.grossToman,
      supplierSettlementCreditToman: settlementTotals.creditToman,
      supplierSettlementCashOutToman,
      supplierSettlementCount: settlementTotals.count,
      supplierDirectCashOutToman,
      supplierDirectPaymentCount: directSupplierPayments._count._all,
      supplierCashOutToman,
      netOperatingCashflowToman:
        customerCashInToman - customerRefundCashOutToman - supplierCashOutToman,
    };
  }

  async suppliers(query: FinancePeriodQueryDto) {
    const period = this.buildDateTimeFilter(query.from, query.to);
    const [
      openPayableGroups,
      availableCreditGroups,
      draftSettlements,
      paidSettlements,
      directPaymentGroups,
    ] = await Promise.all([
      this.prisma.supplierPayable.groupBy({
        by: ['supplierIdSnapshot', 'supplierNameSnapshot'],
        where: {
          status: SupplierPayableStatus.OPEN,
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountToman: true,
        },
        _max: {
          createdAt: true,
        },
      }),
      this.prisma.supplierCredit.groupBy({
        by: ['supplierIdSnapshot', 'supplierNameSnapshot'],
        where: {
          status: {
            in: [SupplierCreditStatus.AVAILABLE, SupplierCreditStatus.PARTIALLY_APPLIED],
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountToman: true,
          appliedAmountToman: true,
        },
        _max: {
          createdAt: true,
        },
      }),
      this.prisma.supplierSettlement.findMany({
        where: {
          status: SupplierSettlementStatus.DRAFT,
          creditAppliedToman: {
            gt: 0,
          },
        },
        select: {
          supplierIdSnapshot: true,
          supplierNameSnapshot: true,
          creditAppliedToman: true,
          createdAt: true,
        },
      }),
      this.prisma.supplierSettlement.findMany({
        where: {
          status: SupplierSettlementStatus.PAID,
          paidAt: period,
        },
        select: {
          supplierIdSnapshot: true,
          supplierNameSnapshot: true,
          totalAmountToman: true,
          creditAppliedToman: true,
          paidAmountToman: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      this.prisma.supplierPayable.groupBy({
        by: ['supplierIdSnapshot', 'supplierNameSnapshot'],
        where: {
          status: SupplierPayableStatus.PAID,
          settlementId: null,
          paidAt: period,
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountToman: true,
        },
        _max: {
          paidAt: true,
          createdAt: true,
        },
      }),
    ]);

    const rows = new Map<string, SupplierReportingRow>();
    const ensure = (supplierId: string, supplierName: string, nameAt: Date | null | undefined) => {
      const at = nameAt ?? new Date(0);
      const existing = rows.get(supplierId);

      if (existing) {
        if (at > existing.latestNameAt) {
          existing.supplierName = supplierName;
          existing.latestNameAt = at;
        }

        return existing;
      }

      const row: SupplierReportingRow = {
        supplierId,
        supplierName,
        latestNameAt: at,
        openPayableToman: 0,
        openPayableCount: 0,
        availableCreditToman: 0,
        availableCreditCount: 0,
        draftAppliedCreditToman: 0,
        settledGrossToman: 0,
        settledCreditToman: 0,
        settledCashPaidToman: 0,
        settlementCount: 0,
        directCashPaidToman: 0,
        directPayableCount: 0,
      };
      rows.set(supplierId, row);
      return row;
    };

    for (const group of openPayableGroups) {
      const row = ensure(
        group.supplierIdSnapshot,
        group.supplierNameSnapshot,
        group._max.createdAt,
      );
      row.openPayableToman += group._sum.amountToman ?? 0;
      row.openPayableCount += group._count._all;
    }

    for (const group of availableCreditGroups) {
      const row = ensure(
        group.supplierIdSnapshot,
        group.supplierNameSnapshot,
        group._max.createdAt,
      );
      row.availableCreditToman +=
        (group._sum.amountToman ?? 0) - (group._sum.appliedAmountToman ?? 0);
      row.availableCreditCount += group._count._all;
    }

    for (const settlement of draftSettlements) {
      const row = ensure(
        settlement.supplierIdSnapshot,
        settlement.supplierNameSnapshot,
        settlement.createdAt,
      );
      row.draftAppliedCreditToman += settlement.creditAppliedToman;
    }

    for (const settlement of paidSettlements) {
      const row = ensure(
        settlement.supplierIdSnapshot,
        settlement.supplierNameSnapshot,
        settlement.paidAt ?? settlement.createdAt,
      );
      const cashPaidToman =
        settlement.paidAmountToman ?? settlement.totalAmountToman - settlement.creditAppliedToman;
      row.settledGrossToman += settlement.totalAmountToman;
      row.settledCreditToman += settlement.creditAppliedToman;
      row.settledCashPaidToman += cashPaidToman;
      row.settlementCount += 1;
    }

    for (const group of directPaymentGroups) {
      const row = ensure(
        group.supplierIdSnapshot,
        group.supplierNameSnapshot,
        group._max.paidAt ?? group._max.createdAt,
      );
      row.directCashPaidToman += group._sum.amountToman ?? 0;
      row.directPayableCount += group._count._all;
    }

    return {
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      currentPositionScope: 'CURRENT',
      settlementAndCashScope: 'PERIOD',
      suppliers: [...rows.values()]
        .map(({ latestNameAt: _latestNameAt, ...row }) => {
          const creditOffsetToman = row.availableCreditToman + row.draftAppliedCreditToman;

          return {
            ...row,
            creditOffsetToman,
            netLiabilityToman: row.openPayableToman - creditOffsetToman,
            totalSupplierCashPaidToman: row.settledCashPaidToman + row.directCashPaidToman,
          };
        })
        .sort((a, b) => b.netLiabilityToman - a.netLiabilityToman),
    };
  }

  private reducePaidSettlements(
    settlements: Array<{
      totalAmountToman: number;
      creditAppliedToman: number;
      paidAmountToman: number | null;
    }>,
  ) {
    let grossToman = 0;
    let creditToman = 0;
    let cashPaidToman = 0;

    for (const settlement of settlements) {
      const cashPaid =
        settlement.paidAmountToman ?? settlement.totalAmountToman - settlement.creditAppliedToman;

      grossToman += settlement.totalAmountToman;
      creditToman += settlement.creditAppliedToman;
      cashPaidToman += cashPaid;
    }

    return {
      grossToman,
      creditToman,
      cashPaidToman,
      count: settlements.length,
    };
  }

  private buildDateTimeFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('Finance report start date must be before the end date.');
    }

    if (!fromDate && !toDate) {
      return undefined;
    }

    return {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }
}
