import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type {
  CatalogFilters,
  PublicCatalogBrand,
  PublicCatalogCategory,
} from '@/lib/catalog/public-catalog';
import { CatalogFilterForm } from './catalog-filter-form';

const filters: CatalogFilters = { page: 1, pageSize: 24, sort: 'newest' };

function category(id: string, name: string): PublicCatalogCategory {
  return {
    id,
    name,
    slug: id,
    description: null,
    parentId: null,
    sortOrder: 0,
    image: null,
  };
}

function brand(id: string, name: string): PublicCatalogBrand {
  return { id, name, slug: id, description: null, image: null, originCountry: null };
}

describe('CatalogFilterForm', () => {
  it('collapses long category and brand lists and keeps only one group expanded', () => {
    render(
      <CatalogFilterForm
        filters={filters}
        categories={[
          category('rings', 'انگشتر'),
          category('bracelets', 'دستبند'),
          category('necklaces', 'گردنبند'),
          category('earrings', 'گوشواره'),
          category('sets', 'نیم‌ست'),
        ]}
        brands={[
          brand('brand-1', 'برند یک'),
          brand('brand-2', 'برند دو'),
          brand('brand-3', 'برند سه'),
          brand('brand-4', 'برند چهار'),
          brand('brand-5', 'برند پنج'),
        ]}
        idPrefix="test-filter"
        className="h-full"
      />,
    );

    const categoryToggle = screen.getAllByRole('button', { name: /نمایش ۱ مورد بیشتر/ })[0];
    const brandToggle = screen.getAllByRole('button', { name: /نمایش ۱ مورد بیشتر/ })[1];
    expect(categoryToggle).toHaveAttribute('aria-expanded', 'false');
    expect(brandToggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(categoryToggle);
    expect(categoryToggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(brandToggle);
    expect(categoryToggle).toHaveAttribute('aria-expanded', 'false');
    expect(brandToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps a selected option outside the first four visible while collapsed', () => {
    render(
      <CatalogFilterForm
        filters={{ ...filters, brand: 'brand-5' }}
        categories={[]}
        brands={[
          brand('brand-1', 'برند یک'),
          brand('brand-2', 'برند دو'),
          brand('brand-3', 'برند سه'),
          brand('brand-4', 'برند چهار'),
          brand('brand-5', 'برند پنج'),
        ]}
        idPrefix="selected-filter"
      />,
    );

    expect(screen.getByRole('radio', { name: 'برند پنج' })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'برند پنج' }).closest('[aria-hidden="true"]'),
    ).toBeNull();
  });
});
