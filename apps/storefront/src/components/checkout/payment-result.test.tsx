import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PaymentResult } from '@/components/checkout/payment-result';

describe('PaymentResult', () => {
  it('renders a confirmed payment with an order-detail link', () => {
    render(<PaymentResult status="success" orderId="order-1" orderNumber="HS-۱۰۰۱" />);

    expect(screen.getByRole('heading', { name: 'پرداخت با موفقیت تأیید شد' })).toBeInTheDocument();
    expect(screen.getByText('سفارش HS-۱۰۰۱')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشاهده جزئیات سفارش' })).toHaveAttribute(
      'href',
      '/account/orders/order-1',
    );
  });

  it('warns against retrying an uncertain payment', () => {
    render(<PaymentResult status="pending" />);

    expect(
      screen.getByRole('heading', { name: 'نتیجه پرداخت در حال بررسی است' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/پرداخت را تکرار نکنید/)).toBeInTheDocument();
  });
});
