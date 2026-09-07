import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminProductsView } from '@/components/products/admin-products-view';
import type { ProductManagementData } from '@/lib/catalog/catalog-data';
import type { CatalogFilters } from '@/lib/catalog/catalog-model';
import { formatAdminToman, toPersianDigits } from '@/lib/presentation/formatters';

const filters: CatalogFilters = {
  q: '',
  status: '',
  brandId: '',
  categoryId: '',
  page: 1,
  limit: 20,
};

const data: ProductManagementData = {
  products: {
    failed: false,
    data: {
      total: 1,
      page: 1,
      limit: 20,
      items: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          name: 'انگشتر نقره',
          slug: 'silver-ring-01',
          shortDescription: null,
          description: null,
          status: 'ACTIVE',
          sizeMode: 'SIZED',
          salePriceToman: 4_500_000,
          compareAtPriceToman: null,
          createdAt: '2026-09-07T10:00:00.000Z',
          updatedAt: '2026-09-07T11:00:00.000Z',
          brand: { id: 'brand-1', name: 'حمیدیان' },
          country: null,
          categories: [{ id: 'category-1', name: 'انگشتر' }],
          variants: [
            {
              id: 'variant-1',
              sku: 'RING-52',
              name: null,
              weightGrams: 4.25,
              active: true,
              size: { id: 'size-1', label: '۵۲' },
            },
          ],
          mediaCount: 2,
        },
      ],
    },
  },
  brands: { failed: false, data: [{ id: 'brand-1', name: 'حمیدیان' }] },
  categories: { failed: false, data: [{ id: 'category-1', name: 'انگشتر' }] },
};

describe('AdminProductsView', () => {
  it('renders operational product data with Persian numbers and mobile details', async () => {
    render(<AdminProductsView data={data} filters={filters} canWrite={false} />);

    expect(screen.getByRole('heading', { name: 'مدیریت محصولات' })).toBeInTheDocument();
    expect(screen.getAllByText(formatAdminToman(4_500_000)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(toPersianDigits('silver-ring-01')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'افزودن محصول' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ویرایش محصول' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'مشاهده جزئیات و عملیات' }));
    expect(await screen.findByRole('dialog', { name: 'انگشتر نقره' })).toBeInTheDocument();
    expect(screen.getByText('SKUهای محصول')).toBeInTheDocument();
    expect(screen.getByText(toPersianDigits('RING-52'))).toBeInTheDocument();
  });
});
