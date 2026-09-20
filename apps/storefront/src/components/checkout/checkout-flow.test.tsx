import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import type { CartItem } from '@/lib/cart/cart-state';
import type { PublicShippingOption } from '@/lib/shipping/public-shipping-pricing';

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

const freeShipping = {
  mode: 'FREE',
  baseCostToman: 0,
  thresholdToman: null,
  discountedCostToman: null,
} as const;

const shippingOptions: readonly PublicShippingOption[] = [
  {
    id: '44444444-4444-4444-8444-444444444441',
    name: 'پست پیشتاز',
    logo: null,
    pricingMode: 'FREE',
    baseCostToman: 0,
    thresholdToman: null,
    discountedCostToman: null,
    serviceArea: 'NATIONWIDE',
  },
  {
    id: '44444444-4444-4444-8444-444444444442',
    name: 'ماهکس',
    logo: null,
    pricingMode: 'FIXED',
    baseCostToman: 70_000,
    thresholdToman: null,
    discountedCostToman: null,
    serviceArea: 'NATIONWIDE',
  },
];

const { clearCart, routerPush } = vi.hoisted(() => ({
  clearCart: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
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

describe('CheckoutFlow price integrity', () => {
  beforeEach(() => {
    clearCart.mockReset();
    routerPush.mockReset();
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

      if (url === '/api/profile/addresses') {
        return jsonResponse([
          {
            id: '33333333-3333-4333-8333-333333333333',
            title: 'خانه',
            recipientName: 'امیر حمیدیان',
            phone: '+989120000000',
            province: 'تهران',
            city: 'تهران',
            addressLine: 'خیابان نمونه، پلاک ۱',
            postalCode: '1234567890',
            isDefault: true,
          },
        ]);
      }

      if (url === '/api/checkout/card-to-card') {
        return jsonResponse({
          enabled: true,
          cardNumber: '6037991234567890',
          holderName: 'گالری حمدیان',
          bankName: 'بانک ملی',
        });
      }

      if (url === '/api/checkout/order') {
        return jsonResponse({
          id: '22222222-2222-4222-8222-222222222222',
          orderNumber: 'HS-TEST',
          shippingTotalToman: 50_000,
          grandTotalToman: 850_000,
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CheckoutFlow shippingOptions={shippingOptions} />);

    await screen.findByText('اطلاعات ارسال');
    await screen.findByText('آدرس پیش‌فرض');
    fireEvent.click(screen.getByRole('button', { name: 'ثبت سفارش و پرداخت کارت‌به‌کارت' }));

    const priceAlert = await screen.findByRole('alert');
    expect(priceAlert).toHaveTextContent('مبلغ جدید را بررسی و تأیید کنید.');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/checkout/order',
      expect.objectContaining({
        body: expect.stringContaining(shippingOptions[0]!.id),
      }),
    );
    for (const radio of screen.getAllByRole('radio', { name: /پست پیشتاز|ماهکس/ })) {
      expect(radio).toBeDisabled();
    }
    expect(
      screen
        .getAllByText(formatTomanPrice(800_000))
        .some((element) => element.classList.contains('line-through')),
    ).toBe(true);
    expect(screen.getByText(formatTomanPrice(850_000))).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input) === '/api/checkout/payment'),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'تأیید مبلغ جدید و پرداخت' }));

    expect(await screen.findByRole('dialog', { name: 'اطلاعات کارت مقصد' })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input) === '/api/checkout/order'),
    ).toHaveLength(1);
    expect(clearCart).not.toHaveBeenCalled();
  });

  it('distinguishes an unavailable API from an expired session without discarding the cart', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'unavailable' }, 503)),
    );
    const unavailable = render(<CheckoutFlow shippingPricing={freeShipping} />);

    expect(await screen.findByText('اتصال به سرویس برقرار نشد')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'بازگشت به سبد خرید' })).toHaveAttribute(
      'href',
      '/cart',
    );
    expect(clearCart).not.toHaveBeenCalled();
    unavailable.unmount();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ message: 'Unauthorized' }, 401)),
    );
    render(<CheckoutFlow shippingPricing={freeShipping} />);

    expect(await screen.findByText('نشست شما منقضی شده است')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ورود یا ثبت‌نام' })).toBeInTheDocument();
    expect(clearCart).not.toHaveBeenCalled();
  });

  it('requires a cart review when a stored variant was deleted or its stock changed', async () => {
    for (const response of [
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'Variant not found.' } }, 404),
      jsonResponse({ error: { code: 'INVENTORY_NOT_AVAILABLE', message: 'No stock.' } }, 409),
    ]) {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/auth/me') return jsonResponse({ phone: '09120000000' });
        if (url === '/api/profile/addresses')
          return jsonResponse([
            {
              id: '33333333-3333-4333-8333-333333333333',
              title: 'خانه',
              recipientName: 'خریدار',
              phone: '09120000000',
              province: 'تهران',
              city: 'تهران',
              addressLine: 'خیابان اصلی',
              postalCode: '1234567890',
              isDefault: true,
            },
          ]);
        if (url === '/api/checkout/order') return response;
        throw new Error(`Unexpected request: ${url}`);
      });
      vi.stubGlobal('fetch', fetchMock);
      const rendered = render(<CheckoutFlow shippingPricing={freeShipping} />);

      await screen.findByText('آدرس پیش‌فرض');
      fireEvent.click(screen.getByRole('button', { name: 'ثبت سفارش و پرداخت کارت‌به‌کارت' }));

      expect(await screen.findByText(/محصول، موجودی یا آدرس ذخیره‌شده/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'بازبینی و اصلاح سبد خرید' })).toHaveAttribute(
        'href',
        '/cart',
      );
      expect(
        screen.queryByRole('button', { name: 'ثبت سفارش و پرداخت کارت‌به‌کارت' }),
      ).not.toBeInTheDocument();
      expect(
        fetchMock.mock.calls.some(([input]) => String(input) === '/api/checkout/payment'),
      ).toBe(false);
      expect(clearCart).not.toHaveBeenCalled();
      rendered.unmount();
    }
  });

  it('keeps bank gateway disabled with a coming-soon badge and selects card-to-card', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/auth/me') return jsonResponse({ phone: '09120000000' });
      if (url === '/api/profile/addresses')
        return jsonResponse([
          {
            id: '33333333-3333-4333-8333-333333333333',
            title: 'خانه',
            recipientName: 'خریدار',
            phone: '09120000000',
            province: 'تهران',
            city: 'تهران',
            addressLine: 'خیابان اصلی',
            postalCode: '1234567890',
            isDefault: true,
          },
        ]);
      if (url === '/api/checkout/card-to-card') {
        return jsonResponse({
          enabled: true,
          cardNumber: '6037991234567890',
          holderName: 'گالری حمدیان',
          bankName: 'بانک ملی',
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<CheckoutFlow shippingPricing={freeShipping} />);

    await screen.findByText('آدرس پیش‌فرض');
    const paymentRadios = screen.getAllByRole('radio');
    expect(paymentRadios).toHaveLength(2);
    expect(paymentRadios[0]).toBeDisabled();
    expect(screen.getByText('به‌زودی')).toBeInTheDocument();
    expect(paymentRadios[1]).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'ثبت سفارش و پرداخت کارت‌به‌کارت' }),
    ).toBeInTheDocument();
  });
});
