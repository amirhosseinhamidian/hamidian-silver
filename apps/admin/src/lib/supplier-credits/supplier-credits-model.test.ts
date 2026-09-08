import { describe, expect, it } from 'vitest';

import {
  parseSupplierCredit,
  parseSupplierCredits,
  supplierCreditRemainingAmount,
} from '@/lib/supplier-credits/supplier-credits-model';

const credit = {
  id: 'credit-1',
  orderId: 'order-1',
  orderItemId: 'order-item-1',
  returnItemId: 'return-item-1',
  supplierIdSnapshot: 'supplier-1',
  supplierNameSnapshot: 'کارگاه نقره آذر',
  quantity: 2,
  unitSupplierPriceToman: 450000,
  amountToman: 900000,
  appliedAmountToman: 250000,
  status: 'PARTIALLY_APPLIED',
  appliedAt: null,
  voidedAt: null,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T11:00:00.000Z',
  order: { id: 'order-1', orderNumber: 'HS-2801' },
  orderItem: {
    id: 'order-item-1',
    productNameSnapshot: 'انگشتر آذر',
    variantNameSnapshot: 'سایز ۵۲',
    skuSnapshot: 'RING-52',
  },
  returnItem: {
    id: 'return-item-1',
    returnId: 'return-1',
    quantity: 2,
    disposition: 'RETURN_TO_SUPPLIER',
  },
  createdBy: {
    id: 'admin-1',
    phone: '09120000000',
    firstName: 'مدیر',
    lastName: 'فروشگاه',
  },
  applications: [
    {
      id: 'application-1',
      settlementId: 'settlement-1',
      amountToman: 250000,
      createdAt: '2026-09-08T10:30:00.000Z',
    },
  ],
};

describe('supplier credits model', () => {
  it('parses list snapshots and computes the usable balance', () => {
    const parsed = parseSupplierCredit(credit);

    expect(parsed).toMatchObject({
      supplierName: 'کارگاه نقره آذر',
      amountToman: 900000,
      appliedAmountToman: 250000,
      order: { orderNumber: 'HS-2801', status: null },
      orderItem: { productName: 'انگشتر آذر', sku: 'RING-52' },
      applications: [{ status: 'ACTIVE', amountToman: 250000 }],
    });
    expect(parsed && supplierCreditRemainingAmount(parsed)).toBe(650000);
  });

  it('parses removed applications from the detail endpoint', () => {
    const parsed = parseSupplierCredit({
      ...credit,
      order: { ...credit.order, status: 'DELIVERED' },
      returnItem: {
        ...credit.returnItem,
        orderReturn: {
          status: 'RECEIVED',
          reason: 'ارسال کالای اشتباه',
          receiveNote: 'تحویل انبار شد.',
        },
      },
      applications: [
        {
          ...credit.applications[0],
          status: 'REMOVED',
          removalReason: 'دوره تسویه لغو شد.',
          removedAt: '2026-09-08T12:00:00.000Z',
          appliedBy: null,
          removedBy: null,
          settlement: {
            id: 'settlement-1',
            status: 'CANCELLED',
            totalAmountToman: 1000000,
            creditAppliedToman: 0,
            paidAmountToman: null,
            paidAt: null,
          },
        },
      ],
    });

    expect(parsed).toMatchObject({
      returnItem: { returnStatus: 'RECEIVED', returnReason: 'ارسال کالای اشتباه' },
      applications: [
        {
          status: 'REMOVED',
          removalReason: 'دوره تسویه لغو شد.',
          settlement: { status: 'CANCELLED' },
        },
      ],
    });
  });

  it('rejects inconsistent applied amounts', () => {
    expect(
      parseSupplierCredits([{ ...credit, appliedAmountToman: credit.amountToman + 1 }]),
    ).toBeNull();
  });
});
