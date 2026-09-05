import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import type { CartItem } from '@/lib/cart/cart-state';

const cartItem: CartItem = {
  key: 'variant-1:NONE',
  variantId: '11111111-1111-4111-8111-111111111111',
  productSlug: 'silver-ring',
  productName: 'انگشتر نقره',
  variantLabel: 'سایز: ۵۴',
  media: null,
  unitSalePriceToman: 800_000,
  unitCompareAtPriceToman: 1_000_000,
  platingType: null,
  unitPlatingPriceToman: 0,
  platingLeadTimeDays: 0,
  quantity: 1,
  maxQuantity: 4,
};

const { clearCart } = vi.hoisted(() => ({
  clearCart: vi.fn(),
}));

vi.mock('@/lib/cart/cart-store', () => ({
  useCart: () => ({
    items: [cartItem],
    itemCount: 1,
    subtotalToman: 800_000,
    clearCart,
  }),
}));

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

function fillShippingAddress() {
  fireEvent.change(screen.getByLabelText(/^نام گیرنده/), {
    target: { value: 'امیر حمیدیان' },
  });
  fireEvent.change(screen.getByLabelText(/^استان/), { target: { value: 'تهران' } });
  fireEvent.change(screen.getByLabelText(/^شهر/), { target: { value: 'تهران' } });
  fireEvent.change(screen.getByLabelText(/^کد پستی ۱۰ رقمی/), {
    target: { value: '1234567890' },
  });
  fireEvent.change(screen.getByLabelText(/^نشانی کامل/), {
    target: { value: 'خیابان نمونه، پلاک ۱' },
  });
}

describe('CheckoutFlow price integrity', () => {
  beforeEach(() => {
    clearCart.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requires explicit confirmation before paying a changed server total', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/auth/me') {
        return jsonResponse({ phone: '09120000000' });
      }

      if (url === '/api/checkout/order') {
        return jsonResponse({
          id: '22222222-2222-4222-8222-222222222222',
          orderNumber: 'HS-TEST',
          grandTotalToman: 850_000,
        });
      }

      if (url === '/api/checkout/payment') {
        return jsonResponse({
          alreadyPaid: true,
          paymentUrl: null,
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CheckoutFlow />);

    await screen.findByText('اطلاعات ارسال');
    fillShippingAddress();
    fireEvent.click(screen.getByRole('button', { name: 'ثبت سفارش و پرداخت' }));

    const priceAlert = await screen.findByRole('alert');
    expect(priceAlert).toHaveTextContent('مبلغ جدید را بررسی و برای ادامه تأیید کنید.');
    expect(screen.getByText(formatTomanPrice(800_000))).toHaveClass('line-through');
    expect(screen.getByText(formatTomanPrice(850_000))).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input) === '/api/checkout/payment'),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'تأیید مبلغ جدید و پرداخت' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input) === '/api/checkout/payment'),
      ).toHaveLength(1);
    });
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input) === '/api/checkout/order'),
    ).toHaveLength(1);
    expect(clearCart).toHaveBeenCalledOnce();
  });
});
