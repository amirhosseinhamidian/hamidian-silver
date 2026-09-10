import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FinancialReportsView } from '@/components/financial-reports/financial-reports-view';
import type { AdminFinancialReportsData } from '@/lib/financial-reports/financial-reports-data';

const data: AdminFinancialReportsData = {
  generatedAt: new Date('2026-09-08T12:00:00.000Z'),
  range: {
    period: '30d',
    from: '2026-08-09T12:00:00.000Z',
    to: '2026-09-08T12:00:00.000Z',
  },
  management: {
    failed: false,
    data: {
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
    },
  },
  cashflow: {
    failed: false,
    data: {
      customerCashInToman: 12_000_000,
      customerCashInOrderCount: 4,
      customerRefundCashOutToman: 500_000,
      customerRefundCount: 1,
      supplierSettlementGrossToman: 7_000_000,
      supplierSettlementCreditToman: 500_000,
      supplierSettlementCashOutToman: 6_500_000,
      supplierSettlementCount: 2,
      supplierDirectCashOutToman: 3_000_000,
      supplierDirectPaymentCount: 2,
      supplierCashOutToman: 9_500_000,
      netOperatingCashflowToman: 2_000_000,
    },
  },
  contribution: {
    failed: false,
    data: {
      paidOrderCount: 4,
      grossProfitBeforeServiceCostsToman: 3_200_000,
      paymentGatewayFeeToman: 100_000,
      shippingProviderCostToman: 300_000,
      platingServiceCostToman: 400_000,
      manualCostAdjustmentToman: 50_000,
      operatingServiceCostToman: 850_000,
      costEntryCount: 8,
      confirmedRefundToman: 500_000,
      confirmedRefundCount: 1,
      contributionMarginToman: 2_350_000,
      contributionAfterRefundsToman: 1_850_000,
    },
  },
  suppliers: {
    failed: false,
    data: [
      {
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
      },
    ],
  },
  reconciliation: {
    failed: false,
    data: {
      count: 1,
      orders: [
        {
          orderId: 'order-1',
          orderNumber: 'HS-1405-120',
          orderStatus: 'PROCESSING',
          paidAt: '2026-09-08T10:00:00.000Z',
          financeSnapshotReady: true,
          missingCosts: ['SHIPPING_PROVIDER_COST_MISSING'],
        },
      ],
    },
  },
};

describe('FinancialReportsView', () => {
  it('renders finance KPIs, cashflow, contribution and responsive drill-downs', () => {
    render(<FinancialReportsView data={data} />);

    expect(screen.getByRole('heading', { name: 'گزارش‌های مالی' })).toBeInTheDocument();
    expect(screen.getByText('دریافت خالص مشتری')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'نمودار جریان نقدی دوره' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /ترکیب هزینه‌های عملیاتی سفارش/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'کارت‌های گزارش تأمین‌کنندگان' })).toHaveClass(
      'md:hidden',
    );
    expect(screen.getByRole('region', { name: 'کارت‌های مغایرت هزینه سفارش' })).toHaveClass(
      'md:hidden',
    );
    expect(screen.getAllByText('نقره‌سازی پارس').length).toBeGreaterThan(1);
    expect(screen.getAllByText('هزینه ارسال').length).toBeGreaterThan(1);
    expect(
      screen.getAllByRole('link', { name: /رفتن به سفارش‌ها|بررسی سفارش‌ها/ })[0],
    ).toHaveAttribute('href', '/orders');
  });

  it('keeps available sections visible when one financial source fails', () => {
    render(<FinancialReportsView data={{ ...data, cashflow: { data: null, failed: true } }} />);

    expect(screen.getByText('گزارش با داده ناقص نمایش داده شده است')).toBeInTheDocument();
    expect(screen.getByText('داده جریان نقدی از سرویس مالی دریافت نشد.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'وضعیت مالی تأمین‌کنندگان' })).toBeInTheDocument();
  });
});
