import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductPurchasePanel } from '@/components/cart/product-purchase-panel';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';
import type { CartItem } from '@/lib/cart/cart-state';

const cartStoreMock = vi.hoisted(() => ({
  items: [] as CartItem[],
  addItem: vi.fn(),
  setQuantity: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@/lib/cart/cart-store', () => ({
  useCart: () => ({
    items: cartStoreMock.items,
    addItem: cartStoreMock.addItem,
    setQuantity: cartStoreMock.setQuantity,
    removeItem: cartStoreMock.removeItem,
  }),
}));

const product: PublicCatalogProductDetail = {
  id: '10000000-0000-4000-8000-000000000010',
  name: 'انگشتر نقره',
  slug: 'silver-ring',
  shortDescription: null,
  description: null,
  salePriceToman: 800_000,
  compareAtPriceToman: null,
  sizeMode: 'SIZED',
  brand: null,
  categories: [],
  primaryMedia: null,
  availableQuantity: 3,
  isAvailable: true,
  country: null,
  media: [],
  variants: [
    {
      id: '10000000-0000-4000-8000-000000000011',
      name: null,
      weightGrams: 4.25,
      size: {
        id: '10000000-0000-4000-8000-000000000012',
        code: '52',
        label: '52',
      },
      platingOptions: [
        {
          type: 'GOLD',
          unitPriceToman: 25_000,
          leadTimeDays: 2,
        },
      ],
      availableQuantity: 3,
      isAvailable: true,
    },
    {
      id: '10000000-0000-4000-8000-000000000013',
      name: null,
      weightGrams: 4.5,
      size: {
        id: '10000000-0000-4000-8000-000000000014',
        code: '54',
        label: '54',
      },
      platingOptions: [],
      availableQuantity: 0,
      isAvailable: false,
    },
  ],
};

describe('ProductPurchasePanel', () => {
  beforeEach(() => {
    cartStoreMock.items = [];
    cartStoreMock.addItem.mockReset();
    cartStoreMock.setQuantity.mockReset();
    cartStoreMock.removeItem.mockReset();
  });

  it('adds one selected item, then exposes cart-linked quantity controls and cart links', () => {
    const view = render(<ProductPurchasePanel product={product} />);

    const addButtons = screen.getAllByRole('button', { name: 'افزودن به سبد خرید' });
    expect(addButtons[0]).toBeDisabled();
    expect(screen.queryByRole('group', { name: 'تعداد' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: '52' }));
    fireEvent.click(screen.getByRole('radio', { name: /آبکاری طلا/ }));
    expect(screen.queryByRole('group', { name: 'تعداد' })).not.toBeInTheDocument();
    fireEvent.click(addButtons[0]);

    expect(cartStoreMock.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: '10000000-0000-4000-8000-000000000011',
        productSlug: 'silver-ring',
        variantLabel: 'سایز: 52',
        unitSalePriceToman: 800_000,
        unitCompareAtPriceToman: null,
        platingType: 'GOLD',
        unitPlatingPriceToman: 25_000,
        platingLeadTimeDays: 2,
        quantity: 1,
        maxQuantity: 3,
      }),
    );

    const addedItem = cartStoreMock.addItem.mock.calls[0]![0] as Omit<CartItem, 'key'>;
    cartStoreMock.items = [{ ...addedItem, key: `${addedItem.variantId}:GOLD` }];
    view.rerender(<ProductPurchasePanel product={product} />);

    expect(screen.getAllByRole('link', { name: 'مشاهده سبد خرید' })).toHaveLength(2);
    const quantityControls = screen.getAllByRole('group', { name: 'تعداد' });
    expect(quantityControls).toHaveLength(2);
    quantityControls.forEach((control) => {
      expect(within(control).getByText('۱')).toBeInTheDocument();
    });

    fireEvent.click(within(quantityControls[0]!).getByRole('button', { name: 'افزایش تعداد' }));
    expect(cartStoreMock.setQuantity).toHaveBeenCalledWith(`${addedItem.variantId}:GOLD`, 2);

    fireEvent.click(
      within(quantityControls[0]!).getByRole('button', { name: 'حذف از سبد خرید' }),
    );
    expect(cartStoreMock.removeItem).toHaveBeenCalledWith(`${addedItem.variantId}:GOLD`);
  });

  it('uses the current cart quantity when the product page is revisited', () => {
    const singleVariantProduct: PublicCatalogProductDetail = {
      ...product,
      variants: [product.variants[0]!],
    };
    cartStoreMock.items = [
      {
        key: '10000000-0000-4000-8000-000000000011:NONE',
        variantId: '10000000-0000-4000-8000-000000000011',
        productSlug: product.slug,
        productName: product.name,
        variantLabel: 'سایز: 52',
        media: null,
        unitSalePriceToman: 800_000,
        unitCompareAtPriceToman: null,
        platingType: null,
        unitPlatingPriceToman: 0,
        platingLeadTimeDays: 0,
        quantity: 2,
        maxQuantity: 3,
      },
    ];

    render(<ProductPurchasePanel product={singleVariantProduct} />);

    screen.getAllByRole('group', { name: 'تعداد' }).forEach((control) => {
      expect(within(control).getByText('۲')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('link', { name: 'مشاهده سبد خرید' })).toHaveLength(2);
  });

  it('stores a named variant as a model while keeping its selector label concise', () => {
    const modelProduct: PublicCatalogProductDetail = {
      ...product,
      sizeMode: 'NONE',
      variants: [
        {
          ...product.variants[0]!,
          name: 'کلاسیک',
          size: null,
        },
      ],
    };

    render(<ProductPurchasePanel product={modelProduct} />);

    expect(screen.queryByText('مدل: کلاسیک')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'افزودن به سبد خرید' })[0]);

    expect(cartStoreMock.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        variantLabel: 'مدل: کلاسیک',
      }),
    );
  });

  it('shows product discount pricing on desktop and mobile without discounting plating', () => {
    render(
      <ProductPurchasePanel
        product={{
          ...product,
          compareAtPriceToman: 1_000_000,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: '52' }));
    fireEvent.click(screen.getByRole('radio', { name: /آبکاری طلا/ }));

    expect(screen.getAllByText(formatTomanPrice(1_000_000))).toHaveLength(2);
    expect(screen.getAllByText(formatTomanPrice(825_000))).toHaveLength(2);
    const discountBadges = screen.getAllByText('۲۰٪');
    expect(discountBadges).toHaveLength(2);
    discountBadges.forEach((badge) => {
      expect(badge).toHaveClass('bg-[var(--sf-color-ink)]', 'text-white');
    });
    expect(screen.queryByText(/تخفیف/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'افزودن به سبد خرید' })[0]);
    expect(cartStoreMock.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        unitSalePriceToman: 800_000,
        unitCompareAtPriceToman: 1_000_000,
        unitPlatingPriceToman: 25_000,
      }),
    );
  });

  it('keeps the mobile add action usable so it can direct the shopper to size selection', () => {
    render(<ProductPurchasePanel product={product} />);

    const addButtons = screen.getAllByRole('button', { name: 'افزودن به سبد خرید' });
    expect(addButtons[0]).toBeDisabled();
    expect(addButtons[1]).toBeEnabled();

    fireEvent.click(addButtons[1]);

    expect(screen.getByRole('alert')).toHaveTextContent('لطفاً سایز را انتخاب کنید.');
    expect(screen.getByRole('alert')).toHaveClass('text-red-600');
    expect(screen.getByRole('alert')).toHaveTextContent('لطفاً سایز را انتخاب کنید.');
    expect(cartStoreMock.addItem).not.toHaveBeenCalled();
  });

  it('does not render invalid discount values from an older product response', () => {
    render(
      <ProductPurchasePanel
        product={{
          ...product,
          compareAtPriceToman: undefined as unknown as null,
        }}
      />,
    );

    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
