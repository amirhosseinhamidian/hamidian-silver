import { describe, expect, it } from 'vitest';

import {
  parseSupplierSettlement,
  parseSupplierSettlements,
  supplierSettlementNetAmount,
} from '@/lib/supplier-settlements/supplier-settlements-model';

const settlement = {
  id: 'settlement-1',
  supplierIdSnapshot: 'supplier-1',
  supplierNameSnapshot: 'نقره‌سازی پارس',
  status: 'DRAFT',
  totalAmountToman: 1_500_000,
  creditAppliedToman: 300_000,
  paidAmountToman: null,
  payableCount: 1,
  note: 'تسویه شهریور',
  paymentReference: null,
  paidAt: null,
  cancelledAt: null,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
  createdBy: null,
  paidBy: null,
  cancelledBy: null,
};

describe('supplier settlements model', () => {
  it('parses list records and computes the net settlement amount', () => {
    const parsed = parseSupplierSettlement(settlement);

    expect(parsed).toMatchObject({
      supplierName: 'نقره‌سازی پارس',
      status: 'DRAFT',
      totalAmountToman: 1_500_000,
      creditAppliedToman: 300_000,
      items: [],
      creditApplications: [],
    });
    expect(parsed && supplierSettlementNetAmount(parsed)).toBe(1_200_000);
  });

  it('parses payable membership and credit application history', () => {
    const parsed = parseSupplierSettlement({
      ...settlement,
      items: [
        {
          id: 'item-1',
          payableId: 'payable-1',
          amountToman: 1_500_000,
          createdAt: '2026-09-08T10:00:00.000Z',
          payable: {
            id: 'payable-1',
            orderId: 'order-1',
            status: 'OPEN',
            supplierIdSnapshot: 'supplier-1',
            supplierNameSnapshot: 'نقره‌سازی پارس',
            quantity: 2,
            unitSupplierPriceToman: 750_000,
            amountToman: 1_500_000,
            order: { orderNumber: 'HS-3010' },
            orderItem: {
              productNameSnapshot: 'انگشتر نقره',
              variantNameSnapshot: 'سایز ۵۸',
              skuSnapshot: 'RING-58',
            },
          },
        },
      ],
      creditApplications: [
        {
          id: 'application-1',
          supplierCreditId: 'credit-1',
          amountToman: 300_000,
          status: 'ACTIVE',
          removalReason: null,
          removedAt: null,
          createdAt: '2026-09-08T10:30:00.000Z',
          appliedBy: null,
          removedBy: null,
          supplierCredit: {
            id: 'credit-1',
            supplierIdSnapshot: 'supplier-1',
            supplierNameSnapshot: 'نقره‌سازی پارس',
            orderId: 'order-returned',
            returnItemId: 'return-item-1',
            amountToman: 500_000,
            appliedAmountToman: 300_000,
            status: 'PARTIALLY_APPLIED',
          },
        },
      ],
    });

    expect(parsed).toMatchObject({
      items: [{ payable: { orderNumber: 'HS-3010', productName: 'انگشتر نقره' } }],
      creditApplications: [
        { status: 'ACTIVE', amountToman: 300_000, supplierCredit: { id: 'credit-1' } },
      ],
    });
  });

  it('rejects a credit total above the settlement total', () => {
    expect(
      parseSupplierSettlements([
        { ...settlement, creditAppliedToman: settlement.totalAmountToman + 1 },
      ]),
    ).toBeNull();
  });
});
