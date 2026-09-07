import { describe, expect, it } from 'vitest';

import {
  orderItemCount,
  orderRequiresAttention,
  parseAdminOrders,
} from '@/lib/orders/orders-model';

const payload = [
  {
    id: 'order-1',
    orderNumber: 'HS-1234',
    status: 'PAID',
    merchandiseTotalToman: 1_200_000,
    platingTotalToman: 100_000,
    discountTotalToman: 50_000,
    shippingTotalToman: 80_000,
    taxTotalToman: 0,
    grandTotalToman: 1_330_000,
    reservationExpiresAt: '2026-09-07T12:15:00.000Z',
    paidAt: '2026-09-07T12:05:00.000Z',
    cancelledAt: null,
    deliveredAt: null,
    returnAuthorizedAt: '2026-09-07T15:00:00.000Z',
    returnAuthorizationReason: 'ارسال کالای اشتباه تأیید شد.',
    returnAuthorizedBy: {
      firstName: 'مدیر',
      lastName: 'فروش',
    },
    createdAt: '2026-09-07T12:00:00.000Z',
    updatedAt: '2026-09-07T12:05:00.000Z',
    user: {
      id: 'user-1',
      phone: '09121234567',
      firstName: 'علی',
      lastName: 'رضایی',
    },
    items: [
      {
        id: 'item-1',
        productNameSnapshot: 'انگشتر آذر',
        variantNameSnapshot: 'سایز ۵۲',
        skuSnapshot: 'RING-52',
        sizeLabelSnapshot: '52',
        quantity: 2,
        unitSalePriceToman: 600_000,
        unitSupplierPriceToman: 400_000,
        supplierNameSnapshot: 'نقره‌سازی پارس',
        platingType: 'GOLD',
        unitPlatingPriceToman: 50_000,
        platingLeadTimeDays: 2,
        unitWeightGrams: '4.250',
        lineTotalToman: 1_300_000,
      },
    ],
    shippingAddress: {
      recipientName: 'علی رضایی',
      phone: '09121234567',
      province: 'تهران',
      city: 'تهران',
      addressLine: 'خیابان نمونه، پلاک ۱۲',
      postalCode: '1234567890',
    },
    payment: {
      id: 'payment-1',
      status: 'PAID',
      amountToman: 1_330_000,
      refundedAmountToman: 0,
      paidAt: '2026-09-07T12:05:00.000Z',
      updatedAt: '2026-09-07T12:05:00.000Z',
      attempts: [
        {
          id: 'attempt-1',
          provider: 'ZARINPAL',
          status: 'VERIFIED',
          amountToman: 1_330_000,
          providerReference: 'REF-123',
          failureCode: null,
          failureMessage: null,
          verifiedAt: '2026-09-07T12:05:00.000Z',
          createdAt: '2026-09-07T12:02:00.000Z',
        },
      ],
    },
    shipment: null,
    statusHistory: [
      {
        id: 'history-1',
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'PAID',
        reason: 'Payment verified',
        createdAt: '2026-09-07T12:05:00.000Z',
        actor: { firstName: 'مدیر', lastName: 'فروش' },
      },
    ],
  },
];

describe('admin orders model', () => {
  it('parses the complete operational order projection', () => {
    const orders = parseAdminOrders(payload);
    expect(orders).not.toBeNull();
    expect(orders?.[0]).toEqual(
      expect.objectContaining({
        orderNumber: 'HS-1234',
        customer: expect.objectContaining({ name: 'علی رضایی' }),
        address: expect.objectContaining({ postalCode: '1234567890' }),
        payment: expect.objectContaining({ status: 'PAID' }),
        returnAuthorization: {
          authorizedAt: '2026-09-07T15:00:00.000Z',
          reason: 'ارسال کالای اشتباه تأیید شد.',
          actor: 'مدیر فروش',
        },
      }),
    );
    expect(orders?.[0]?.items[0]).toEqual(
      expect.objectContaining({ unitWeightGrams: 4.25, supplierName: 'نقره‌سازی پارس' }),
    );
    expect(orders?.[0] && orderItemCount(orders[0])).toBe(2);
    expect(orders?.[0] && orderRequiresAttention(orders[0])).toBe(false);
  });

  it('flags payment reconciliation and shipment failure', () => {
    const order = parseAdminOrders(payload)?.[0];
    expect(
      order &&
        orderRequiresAttention({
          ...order,
          payment: order.payment && { ...order.payment, status: 'RECONCILIATION_REQUIRED' },
        }),
    ).toBe(true);
  });

  it('rejects incomplete or unknown order records', () => {
    expect(parseAdminOrders([{ id: 'order-1', status: 'UNKNOWN' }])).toBeNull();
  });
});
