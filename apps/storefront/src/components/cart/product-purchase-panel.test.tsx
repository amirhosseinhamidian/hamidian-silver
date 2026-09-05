import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductPurchasePanel } from '@/components/cart/product-purchase-panel';
import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';

const { addItem } = vi.hoisted(() => ({
  addItem: vi.fn(),
}));

vi.mock('@/lib/cart/cart-store', () => ({
  useCart: () => ({
    addItem,
  }),
}));

const product: PublicCatalogProductDetail = {
  id: '10000000-0000-4000-8000-000000000010',
  name: 'انگشتر نقره',
  slug: 'silver-ring',
  shortDescription: null,
  description: null,
  salePriceToman: 800_000,
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
    addItem.mockReset();
  });

  it('requires an available variant and sends only the selected purchase snapshot to the cart', () => {
    render(<ProductPurchasePanel product={product} />);

    const addButtons = screen.getAllByRole('button', { name: 'افزودن به سبد خرید' });
    expect(addButtons[0]).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '52' }));
    fireEvent.click(screen.getByRole('radio', { name: /آبکاری طلا/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'افزایش تعداد' })[0]);
    fireEvent.click(addButtons[0]);

    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: '10000000-0000-4000-8000-000000000011',
        productSlug: 'silver-ring',
        variantLabel: 'سایز: 52',
        unitSalePriceToman: 800_000,
        platingType: 'GOLD',
        unitPlatingPriceToman: 25_000,
        platingLeadTimeDays: 2,
        quantity: 2,
        maxQuantity: 3,
      }),
    );
    expect(screen.getByText('محصول به سبد خرید اضافه شد.')).toBeInTheDocument();
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

    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        variantLabel: 'مدل: کلاسیک',
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
    expect(addItem).not.toHaveBeenCalled();
  });
});
