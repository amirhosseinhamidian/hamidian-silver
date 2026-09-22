import { formatAdminOrderMessage } from './admin-order-message.formatter';

describe('formatAdminOrderMessage', () => {
  const order = {
    id: '8f987959-c020-4af3-bb0d-2cd59cb0bd65',
    orderNumber: 'HS-TEST',
    createdAt: new Date('2026-09-21T12:00:00.000Z'),
    merchandiseTotalToman: 10_000,
    platingTotalToman: 2_000,
    discountTotalToman: 0,
    shippingTotalToman: 1_000,
    taxTotalToman: 0,
    grandTotalToman: 13_000,
    payment: { status: 'PAID' },
    customerNote: 'لطفاً عصر تحویل شود.',
    shippingCarrierNameSnapshot: 'ماهکس',
    user: { phone: '09121234567', firstName: 'امیر', lastName: 'حمیدیان' },
    shippingAddress: {
      recipientName: 'امیر حمیدیان',
      phone: '09121234567',
      province: 'تهران',
      city: 'تهران',
      addressLine: 'خیابان نمونه',
      postalCode: '1234567890',
    },
    items: [
      {
        productNameSnapshot: 'انگشتر نقره',
        variantNameSnapshot: null,
        skuSnapshot: 'SKU-1',
        sizeLabelSnapshot: '۵۸',
        platingType: 'GOLD' as const,
        quantity: 1,
        lineTotalToman: 12_000,
      },
    ],
  };

  it('includes paid order essentials and the direct admin link', () => {
    const message = formatAdminOrderMessage(order, 'https://admin.hamidian.shop/');

    expect(message).toContain('HS-TEST');
    expect(message).toContain('پرداخت موفق سفارش');
    expect(message).toContain('وضعیت: پرداخت‌شده');
    expect(message).toContain('ماهکس');
    expect(message).toContain('لطفاً عصر تحویل شود.');
    expect(message).toContain(
      'https://admin.hamidian.shop/orders?orderId=8f987959-c020-4af3-bb0d-2cd59cb0bd65',
    );
    expect(message.length).toBeLessThanOrEqual(4000);
  });

  it('labels a card-to-card receipt as awaiting review', () => {
    const message = formatAdminOrderMessage(
      { ...order, payment: { status: 'AWAITING_REVIEW' } },
      'https://admin.hamidian.shop/',
    );

    expect(message).toContain('رسید کارت‌به‌کارت جدید');
    expect(message).toContain('وضعیت: رسید کارت‌به‌کارت در انتظار تأیید');
    expect(message).not.toContain('وضعیت: پرداخت‌شده');
  });
});
