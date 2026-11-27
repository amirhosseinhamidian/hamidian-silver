import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  emptyCatalogFacets,
  type CatalogFacetFilters,
  type PublicCatalogFacets,
} from '@/lib/catalog/catalog-filter-state';
import { CatalogFilterForm } from './catalog-filter-form';

const filters: CatalogFacetFilters = { page: 1, pageSize: 24, sort: 'newest' };
const facets: PublicCatalogFacets = {
  ...emptyCatalogFacets,
  categories: ['انگشتر', 'دستبند', 'گردنبند', 'گوشواره', 'نیم‌ست'].map((label, index) => ({
    value: `category-${index + 1}`,
    label,
    count: index + 1,
  })),
  brands: ['برند یک', 'برند دو', 'برند سه', 'برند چهار', 'برند پنج'].map((label, index) => ({
    value: `brand-${index + 1}`,
    label,
    count: index + 1,
  })),
  priceToman: { min: 100_000, max: 900_000, count: 4 },
};

function renderForm(onApply = vi.fn(), selected = filters) {
  return render(
    <CatalogFilterForm
      path="/products"
      filters={selected}
      facets={facets}
      idPrefix="test-filter"
      onApply={onApply}
    />,
  );
}

describe('CatalogFilterForm', () => {
  it('collapses long choices and makes only the expanded group interactive', () => {
    renderForm();
    const [categories, brands] = screen.getAllByRole('button', { name: /نمایش ۱ مورد بیشتر/ });
    expect(categories).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('checkbox', { name: /نیم‌ست/ })).not.toBeInTheDocument();
    fireEvent.click(categories);
    expect(screen.getByRole('checkbox', { name: /نیم‌ست.*۵ محصول/ })).toBeVisible();
    fireEvent.click(brands);
    expect(categories).toHaveAttribute('aria-expanded', 'false');
    expect(brands).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps selected choices visible and applies multiple values and a Persian price', () => {
    const onApply = vi.fn();
    renderForm(onApply, { ...filters, brands: ['brand-5'] });
    expect(screen.getByRole('checkbox', { name: /برند پنج/ })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /برند یک/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /حداکثر قیمت/ }), {
      target: { value: '۵۰۰٬۰۰۰' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'اعمال فیلترها' }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ brands: ['brand-1', 'brand-5'], maxPriceToman: 500_000 }),
    );
  });

  it('shows an actionable validation message for reversed ranges', () => {
    const onApply = vi.fn();
    renderForm(onApply);
    fireEvent.change(screen.getByRole('textbox', { name: /حداقل قیمت/ }), {
      target: { value: '۶۰۰۰۰۰' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /حداکثر قیمت/ }), {
      target: { value: '۵۰۰۰۰۰' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'اعمال فیلترها' }));
    expect(screen.getByRole('alert')).toHaveTextContent('بازه‌ها را با عدد معتبر وارد کنید');
    expect(onApply).not.toHaveBeenCalled();
  });
});
