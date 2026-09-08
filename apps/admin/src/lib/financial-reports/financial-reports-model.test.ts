import { describe, expect, it } from 'vitest';

import {
  financialReportRange,
  parseFinanceContributionReport,
  parseFinanceCostReconciliationReport,
  parseFinanceManagementReport,
  parseFinanceSuppliersReport,
  parseFinancialReportPeriod,
} from '@/lib/financial-reports/financial-reports-model';

describe('financial reports model', () => {
  it('normalizes supported periods and builds a deterministic API range', () => {
    const now = new Date('2026-09-08T12:00:00.000Z');

    expect(parseFinancialReportPeriod('90d')).toBe('90d');
    expect(parseFinancialReportPeriod('invalid')).toBe('30d');
    expect(financialReportRange('7d', now)).toEqual({
      period: '7d',
      from: '2026-09-01T12:00:00.000Z',
      to: '2026-09-08T12:00:00.000Z',
    });
    expect(financialReportRange('all', now)).toEqual({ period: 'all', from: null, to: null });
  });

  it('parses management and contribution totals including signed margins', () => {
    expect(
      parseFinanceManagementReport({
        paidOrderCount: 4,
        customerGrossCollectedToman: 12_000_000,
        confirmedRefundToman: 500_000,
        confirmedRefundCount: 1,
        customerNetCollectedToman: 11_500_000,
        grossProfitBeforeServiceCostsToman: 3_200_000,
        netOperatingCashflowToman: 2_000_000,
        supplierPosition: {
          openPayableToman: 5_000_000,
          openPayableCount: 3,
          availableCreditToman: 600_000,
          availableCreditCount: 1,
          draftAppliedCreditToman: 200_000,
          draftSettlementCount: 1,
          creditOffsetToman: 800_000,
          netLiabilityToman: 4_200_000,
        },
        supplierPayments: {
          settledGrossToman: 7_000_000,
          settledCreditToman: 500_000,
          settledCashPaidToman: 6_500_000,
          settlementCount: 2,
          directCashPaidToman: 3_000_000,
          directPayableCount: 2,
          totalCashPaidToman: 9_500_000,
        },
      }),
    ).toMatchObject({
      customerNetCollectedToman: 11_500_000,
      supplierPosition: { netLiabilityToman: 4_200_000 },
    });

    expect(
      parseFinanceContributionReport({
        paidOrderCount: 4,
        grossProfitBeforeServiceCostsToman: 3_200_000,
        paymentGatewayFeeToman: 100_000,
        shippingProviderCostToman: 300_000,
        platingServiceCostToman: 400_000,
        manualCostAdjustmentToman: -50_000,
        operatingServiceCostToman: 750_000,
        costEntryCount: 8,
        confirmedRefundToman: 500_000,
        confirmedRefundCount: 1,
        contributionMarginToman: 2_450_000,
        contributionAfterRefundsToman: 1_950_000,
      })?.manualCostAdjustmentToman,
    ).toBe(-50_000);
  });

  it('parses supplier positions and rejects inconsistent financial rows', () => {
    const supplier = {
      supplierId: 'supplier-1',
      supplierName: 'نقره‌سازی پارس',
      openPayableToman: 5_000_000,
      openPayableCount: 3,
      availableCreditToman: 600_000,
      availableCreditCount: 1,
      draftAppliedCreditToman: 200_000,
      settledGrossToman: 7_000_000,
      settledCreditToman: 500_000,
      settledCashPaidToman: 6_500_000,
      settlementCount: 2,
      directCashPaidToman: 3_000_000,
      directPayableCount: 2,
      creditOffsetToman: 800_000,
      netLiabilityToman: 4_200_000,
      totalSupplierCashPaidToman: 9_500_000,
    };

    expect(parseFinanceSuppliersReport({ suppliers: [supplier] })?.[0].supplierName).toBe(
      'نقره‌سازی پارس',
    );
    expect(
      parseFinanceSuppliersReport({ suppliers: [{ ...supplier, openPayableToman: -1 }] }),
    ).toBeNull();
  });

  it('validates missing order-cost reconciliation codes and row counts', () => {
    const report = {
      count: 1,
      orders: [
        {
          orderId: 'order-1',
          orderNumber: 'HS-1405-120',
          orderStatus: 'PROCESSING',
          paidAt: '2026-09-08T10:00:00.000Z',
          financeSnapshotReady: true,
          missingCosts: [{ code: 'SHIPPING_PROVIDER_COST_MISSING' }],
        },
      ],
    };

    expect(parseFinanceCostReconciliationReport(report)?.orders[0].missingCosts).toEqual([
      'SHIPPING_PROVIDER_COST_MISSING',
    ]);
    expect(parseFinanceCostReconciliationReport({ ...report, count: 2 })).toBeNull();
    expect(
      parseFinanceCostReconciliationReport({
        ...report,
        orders: [{ ...report.orders[0], missingCosts: [{ code: 'UNKNOWN' }] }],
      }),
    ).toBeNull();
  });
});
