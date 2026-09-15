import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CartPage from '@/app/(shop)/cart/page';
import { formatTomanPrice } from '@/lib/catalog/presentation';

const { cartItem, removeItem } = vi.hoisted(() => ({
  cartItem: {
    key: 'variant-1:GOLD',
    variantId: '11111111-1111-4111-8111-111111111111',
    productSlug: 'silver-ring',
    productName: 'انگشتر نقره',
    variantLabel: 'سایز: ۵۴',
    media: null,
    unitSalePriceToman: 800_000,
    unitCompareAtPriceToman: 1_000_000,
    platingType: 'GOLD' as const,
    unitPlatingPriceToman: 25_000,
    platingLeadTimeDays: 2,
    quantity: 1,
    maxQuantity: 4,
  },
  removeItem: vi.fn(),
}));

vi.mock('@/lib/cart/cart-store', () => ({
  useCart: () => ({
    items: [cartItem],
    itemCount: 1,
    subtotalToman: 825_000,
    setQuantity: vi.fn(),
    removeItem,
  }),
}));

describe('CartPage', () => {
  beforeEach(() => {
    removeItem.mockReset();
  });

  it('shows the product discount snapshot without discounting plating', () => {
    render(<CartPage />);

    expect(screen.getByText(formatTomanPrice(1_000_000))).toHaveClass('line-through');
    expect(screen.getAllByText(formatTomanPrice(825_000)).length).toBeGreaterThan(0);
    expect(screen.getByText('۲۰٪')).toHaveClass('bg-[var(--sf-color-ink)]', 'text-white');
    expect(screen.queryByText(/تخفیف/)).not.toBeInTheDocument();
  });

  it('uses the quantity control remove action when a line has one item', () => {
    render(<CartPage />);

    fireEvent.click(screen.getByRole('button', { name: 'حذف از سبد خرید' }));

    expect(removeItem).toHaveBeenCalledWith(cartItem.key);
    expect(screen.queryByRole('button', { name: 'کاهش تعداد' })).not.toBeInTheDocument();
  });
});
