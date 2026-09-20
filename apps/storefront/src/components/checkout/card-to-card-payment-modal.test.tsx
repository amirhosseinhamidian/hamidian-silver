import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CardToCardPaymentModal } from '@/components/checkout/card-to-card-payment-modal';

const settings = {
  enabled: true,
  cardNumber: '6037991234567890',
  ibanNumber: '820540102680020817909002',
  holderName: 'گالری حمیدیان',
  bankName: 'بانک ملی ایران',
} as const;

describe('CardToCardPaymentModal transfer details', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows IR but copies the raw 24 IBAN digits', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <CardToCardPaymentModal
        open
        orderId="22222222-2222-4222-8222-222222222222"
        orderNumber="HS-TEST"
        amountToman={38_000_000}
        settings={settings}
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
      />,
    );

    expect(screen.getByText('IR82 0540 1026 8002 0817 9090 02')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTitle('کپی شماره شبا بدون IR')[0]!);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('820540102680020817909002'));
    expect(screen.getByText('بدون IR کپی شد')).toBeInTheDocument();
  });

  it('shows the amount in rial and copies raw rial digits', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <CardToCardPaymentModal
        open
        orderId="22222222-2222-4222-8222-222222222222"
        orderNumber="HS-TEST"
        amountToman={38_000_000}
        settings={settings}
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
      />,
    );

    expect(screen.getByText('۳۸۰٬۰۰۰٬۰۰۰ ریال')).toBeInTheDocument();
    expect(screen.getByText(/معادل.*۳۸٬۰۰۰٬۰۰۰ تومان/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByTitle('کپی مبلغ به ریال')[0]!);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('380000000'));
    expect(screen.getByText('مبلغ کپی شد')).toBeInTheDocument();
  });

  it('recommends an intra-bank transfer when source and destination match', () => {
    render(
      <CardToCardPaymentModal
        open
        orderId="22222222-2222-4222-8222-222222222222"
        orderNumber="HS-TEST"
        amountToman={38_000_000}
        settings={settings}
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
      />,
    );

    expect(screen.getByText('پل با شماره شبا')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('بانک مبدأ شما کدام است؟'), {
      target: { value: 'بانک ملی ایران' },
    });
    expect(screen.getByText('انتقال درون‌بانکی / حساب‌به‌حساب')).toBeInTheDocument();
    expect(
      screen.getByText(/پیشنهاد شبکه بانکی برای این مبلغ: پل با شماره شبا/),
    ).toBeInTheDocument();
  });
});
