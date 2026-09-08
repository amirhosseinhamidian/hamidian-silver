import { describe, expect, it } from 'vitest';

import { parseOrderReturn, parseOrderReturns } from '@/lib/returns/returns-model';

const orderReturn = {
  id: 'return-1',
  orderId: 'order-1',
  order: {
    id: 'order-1',
    orderNumber: 'HS-2701',
    status: 'DELIVERED',
    warehouseId: 'warehouse-1',
  },
  status: 'REQUESTED',
  reason: 'سایز کالا مناسب نیست.',
  receiveNote: null,
  cancelReason: null,
  requestedBy: {
    id: 'user-1',
    phone: '09121234567',
    firstName: 'مینا',
    lastName: 'محمدی',
  },
  receivedBy: null,
  cancelledBy: null,
  receivedAt: null,
  cancelledAt: null,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
  items: [
    {
      id: 'return-item-1',
      orderItemId: 'order-item-1',
      quantity: 1,
      disposition: null,
      orderItem: {
        id: 'order-item-1',
        productNameSnapshot: 'انگشتر آذر',
        variantNameSnapshot: 'سایز ۵۲',
        skuSnapshot: 'RING-52',
        quantity: 2,
        returnAllocatedQuantity: 1,
        returnedQuantity: 0,
        supplierIdSnapshot: 'supplier-1',
        supplierNameSnapshot: 'تأمین نقره',
        unitSupplierPriceToman: 450000,
      },
      supplierCredit: null,
    },
  ],
};

describe('returns model', () => {
  it('parses allocation, item and actor snapshots', () => {
    expect(parseOrderReturn(orderReturn)).toMatchObject({
      orderNumber: 'HS-2701',
      status: 'REQUESTED',
      requestedBy: { firstName: 'مینا' },
      items: [
        {
          quantity: 1,
          orderItem: {
            productName: 'انگشتر آذر',
            allocatedQuantity: 1,
            unitSupplierPriceToman: 450000,
          },
        },
      ],
    });
  });

  it('rejects malformed allocation values', () => {
    expect(
      parseOrderReturns([
        {
          ...orderReturn,
          items: [
            {
              ...orderReturn.items[0],
              orderItem: {
                ...orderReturn.items[0].orderItem,
                returnAllocatedQuantity: -1,
              },
            },
          ],
        },
      ]),
    ).toBeNull();
  });
});
