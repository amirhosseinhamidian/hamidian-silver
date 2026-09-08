import { describe, expect, it } from 'vitest';

import {
  parseSupplierPayables,
  parseSupplierPayableSummary,
  supplierPayablePeriod,
} from '@/lib/supplier-payables/supplier-payables-model';

const payable = {
  id: 'payable-1',
  orderId: 'order-1',
  orderItemId: 'item-1',
  supplierIdSnapshot: 'supplier-1',
  supplierNameSnapshot: 'نقره‌سازی پارس',
  quantity: 2,
  unitSupplierPriceToman: 750_000,
  amountToman: 1_500_000,
  status: 'OPEN',
  settlementId: null,
  paidAt: null,
  paymentReference: null,
  settlementNote: null,
  createdAt: '2026-09-08T08:00:00.000Z',
  updatedAt: '2026-09-08T08:00:00.000Z',
  order: {
    id: 'order-1',
    orderNumber: 'HS-1405-120',
    status: 'PAID',
    paidAt: '2026-09-08T07:50:00.000Z',
  },
  orderItem: {
    id: 'item-1',
    productNameSnapshot: 'انگشتر نقره',
    variantNameSnapshot: 'سایز ۵۸',
    skuSnapshot: 'RING-58',
  },
  paidBy: null,
};

describe('supplier payables model', () => {
  it('parses a payable response and preserves its financial snapshots', () => {
    const result = parseSupplierPayables([payable]);

    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({
      supplierName: 'نقره‌سازی پارس',
      amountToman: 1_500_000,
      status: 'OPEN',
      orderItem: { productName: 'انگشتر نقره', sku: 'RING-58' },
    });
    expect(supplierPayablePeriod(payable.createdAt)).not.toBe('دوره نامشخص');
  });

  it('rejects invalid payable rows instead of rendering partial financial data', () => {
    expect(parseSupplierPayables([{ ...payable, amountToman: -1 }])).toBeNull();
    expect(parseSupplierPayables([{ ...payable, status: 'UNKNOWN' }])).toBeNull();
  });

  it('validates supplier summary totals', () => {
    const summary = {
      supplierIdSnapshot: 'supplier-1',
      supplierNameSnapshot: 'نقره‌سازی پارس',
      openAmountToman: 1_500_000,
      openCount: 1,
      paidAmountToman: 500_000,
      paidCount: 1,
      totalAmountToman: 2_000_000,
      totalCount: 2,
    };

    expect(parseSupplierPayableSummary([summary])?.[0].totalAmountToman).toBe(2_000_000);
    expect(parseSupplierPayableSummary([{ ...summary, totalAmountToman: 2_000_001 }])).toBeNull();
  });
});
