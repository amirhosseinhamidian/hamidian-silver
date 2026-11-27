import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { restoreCart } from '@/lib/cart/cart-store';
import { CartRecoveryPanel } from './cart-recovery-panel';

vi.mock('@/lib/cart/cart-store', () => ({ restoreCart: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
});

it('shows price and quantity changes and waits for explicit recovery', async () => {
  const current = { cartId: '00000000-0000-4000-8000-000000000000', revision: 1 };
  const item = {
    variantId: '00000000-0000-4000-8000-000000000001',
    productSlug: 'silver-ring',
    productName: 'انگشتر',
    variantLabel: 'سایز ۵۲',
    quantity: 1,
    maxQuantity: 1,
    unitSalePriceToman: 9_000,
    unitPlatingPriceToman: 0,
    platingType: null,
    platingLeadTimeDays: 0,
  };
  const review = {
    lines: [
      { item, productName: 'انگشتر', previousQuantity: 2, previousUnitToman: 8_000 },
      { item: null, productName: 'دستبند', previousQuantity: 1, previousUnitToman: 5_000 },
    ],
    reviewKey: 'a'.repeat(64),
  };
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('action=preview')) return Response.json({ ...review, applied: false });
    if (url.includes('action=restore')) return Response.json({ ...review, applied: true });
    return Response.json({ current, itemCount: 3, expiresAt: null, showReminder: true });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<CartRecoveryPanel items={[]} />);
  fireEvent.click(await screen.findByRole('button', { name: 'بررسی سبد ذخیره‌شده' }));
  expect(await screen.findByText(/قیمت قبلی/)).toBeInTheDocument();
  expect(screen.getByText(/تعداد قبلی/)).toBeInTheDocument();
  expect(screen.getByText(/دیگر قابل خرید نیست/)).toBeInTheDocument();
  expect(restoreCart).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'تأیید و بازیابی سبد' }));
  await waitFor(() =>
    expect(restoreCart).toHaveBeenCalledWith(
      [{ ...item, media: null, unitCompareAtPriceToman: null }],
      current,
    ),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/cart/recovery?action=restore',
    expect.objectContaining({ body: JSON.stringify({ ...current, reviewKey: review.reviewKey }) }),
  );
});
