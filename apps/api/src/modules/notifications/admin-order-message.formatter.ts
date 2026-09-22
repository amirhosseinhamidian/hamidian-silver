type OrderMessageSource = Readonly<{
  id: string;
  orderNumber: string;
  createdAt: Date;
  merchandiseTotalToman: number;
  platingTotalToman: number;
  discountTotalToman: number;
  shippingTotalToman: number;
  taxTotalToman: number;
  grandTotalToman: number;
  payment: Readonly<{ status: string }> | null;
  customerNote: string | null;
  shippingCarrierNameSnapshot: string | null;
  user: Readonly<{
    phone: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  shippingAddress: Readonly<{
    recipientName: string;
    phone: string;
    province: string;
    city: string;
    addressLine: string;
    postalCode: string;
  }> | null;
  items: readonly Readonly<{
    productNameSnapshot: string;
    variantNameSnapshot: string | null;
    skuSnapshot: string;
    sizeLabelSnapshot: string | null;
    platingType: 'GOLD' | 'ROSE_GOLD' | 'RHODIUM' | null;
    quantity: number;
    lineTotalToman: number;
  }>[];
}>;

const toman = new Intl.NumberFormat('fa-IR');
const dateTime = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

const PLATING_LABELS: Record<
  NonNullable<OrderMessageSource['items'][number]['platingType']>,
  string
> = {
  GOLD: 'طلایی',
  ROSE_GOLD: 'رزگلد',
  RHODIUM: 'رودیوم',
};

export function formatAdminOrderMessage(order: OrderMessageSource, adminOrigin: string): string {
  const awaitingReceiptReview = order.payment?.status === 'AWAITING_REVIEW';
  const customerName = [order.user.firstName, order.user.lastName].filter(Boolean).join(' ');
  const itemLines = order.items.map((item, index) => {
    const details = [
      item.variantNameSnapshot,
      item.sizeLabelSnapshot ? `سایز ${item.sizeLabelSnapshot}` : null,
      item.platingType ? `آبکاری ${PLATING_LABELS[item.platingType]}` : null,
      `کد ${item.skuSnapshot}`,
    ].filter(Boolean);
    return `${toman.format(index + 1)}) ${item.productNameSnapshot}${details.length ? ` (${details.join('، ')})` : ''} × ${toman.format(item.quantity)} — ${toman.format(item.lineTotalToman)} تومان`;
  });
  const address = order.shippingAddress;
  const lines = [
    awaitingReceiptReview
      ? '🧾 رسید کارت‌به‌کارت جدید در گالری حمیدیان'
      : '✅ پرداخت موفق سفارش در گالری حمیدیان',
    '',
    `شماره سفارش: ${order.orderNumber}`,
    `زمان ثبت: ${dateTime.format(order.createdAt)}`,
    `وضعیت: ${awaitingReceiptReview ? 'رسید کارت‌به‌کارت در انتظار تأیید' : 'پرداخت‌شده'}`,
    `مشتری: ${customerName || 'بدون نام'} — ${order.user.phone}`,
    ...(address
      ? [
          `تحویل‌گیرنده: ${address.recipientName} — ${address.phone}`,
          `آدرس: ${address.province}، ${address.city}، ${address.addressLine}`,
          `کد پستی: ${address.postalCode}`,
        ]
      : []),
    '',
    'اقلام سفارش:',
    ...itemLines,
    '',
    `جمع کالا: ${toman.format(order.merchandiseTotalToman)} تومان`,
    ...(order.platingTotalToman ? [`آبکاری: ${toman.format(order.platingTotalToman)} تومان`] : []),
    ...(order.discountTotalToman ? [`تخفیف: ${toman.format(order.discountTotalToman)} تومان`] : []),
    `ارسال${order.shippingCarrierNameSnapshot ? ` (${order.shippingCarrierNameSnapshot})` : ''}: ${toman.format(order.shippingTotalToman)} تومان`,
    ...(order.taxTotalToman ? [`مالیات: ${toman.format(order.taxTotalToman)} تومان`] : []),
    `مبلغ نهایی: ${toman.format(order.grandTotalToman)} تومان`,
    ...(order.customerNote ? ['', `یادداشت مشتری: ${order.customerNote}`] : []),
    '',
    'جزئیات سفارش در پنل مدیریت:',
    `${adminOrigin.replace(/\/$/, '')}/orders?orderId=${encodeURIComponent(order.id)}`,
  ];
  const message = lines.join('\n');
  return message.length <= 4000 ? message : `${message.slice(0, 3970)}\n…`;
}
