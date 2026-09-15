import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StorefrontHome } from '@/components/home/storefront-home';
import type { PublicHomepage } from '@/lib/home/public-homepage';

const product = {
  id: 'product-1',
  name: 'انگشتر نقره',
  slug: 'silver-ring',
  shortDescription: null,
  salePriceToman: 1_000_000,
  compareAtPriceToman: null,
  sizeMode: 'SIZED' as const,
  brand: null,
  categories: [],
  primaryMedia: null,
  availableQuantity: 1,
  isAvailable: true,
};

const homepage: PublicHomepage = {
  primaryHeroSlides: [],
  secondaryHero: null,
  newProducts: Array.from({ length: 4 }, (_, index) => ({
    ...product,
    id: `new-${index}`,
    slug: `new-${index}`,
  })),
  featuredCategories: [
    {
      id: 'category-1',
      name: 'انگشتر',
      slug: 'rings',
      description: null,
      parentId: null,
      sortOrder: 0,
      image: null,
      priority: 1,
    },
    {
      id: 'category-3',
      name: 'گردنبند',
      slug: 'necklaces',
      description: null,
      parentId: null,
      sortOrder: 0,
      image: null,
      priority: 3,
    },
  ],
  popularProducts: [{ ...product, id: 'popular-1', slug: 'popular-1' }],
  featuredBrands: Array.from({ length: 6 }, (_, index) => ({
    id: `brand-${index + 1}`,
    name: `برند ${index + 1}`,
    slug: `brand-${index + 1}`,
    description: null,
    image: null,
    originCountry: { id: 'country-1', name: 'ایران', slug: 'iran', isoCode: 'IR' },
  })),
  manufacturerCountriesEnabled: true,
  manufacturerCountries: [
    { id: 'country-4', name: 'ایتالیا', slug: 'italy', isoCode: 'IT', image: null, priority: 1 },
    { id: 'country-2', name: 'ترکیه', slug: 'turkey', isoCode: 'TR', image: null, priority: 2 },
    { id: 'country-3', name: 'تایلند', slug: 'thailand', isoCode: 'TH', image: null, priority: 3 },
    { id: 'country-1', name: 'ایران', slug: 'iran', isoCode: 'IR', image: null, priority: 4 },
  ],
};

describe('StorefrontHome', () => {
  it('renders the requested section order, four new badges, and quality guarantee', () => {
    render(<StorefrontHome homepage={homepage} />);

    expect(screen.getAllByText('جدید')).toHaveLength(4);
    expect(screen.getAllByText('برند ایران')).toHaveLength(4);
    expect(screen.getByRole('heading', { name: 'برند 4' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'برند 5' })).not.toBeInTheDocument();
    expect(screen.getByText('ضمانت کیفیت')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'کشورهای سازنده' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ایتالیا/ })).toHaveAttribute(
      'href',
      '/products?country=italy',
    );

    const newProducts = screen.getByRole('heading', { name: 'جدیدترین محصولات' });
    const firstCategory = screen.getByRole('heading', { name: 'انگشتر' });
    const popular = screen.getByRole('heading', { name: 'محبوب‌ترین محصولات' });
    const brands = screen.getByRole('heading', { name: 'برندها' });
    const lastCategory = screen.getByRole('heading', { name: 'گردنبند' });

    expect(newProducts.compareDocumentPosition(firstCategory)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(firstCategory.compareDocumentPosition(popular)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(popular.compareDocumentPosition(brands)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(brands.compareDocumentPosition(lastCategory)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('does not render manufacturer countries while the section is disabled', () => {
    render(<StorefrontHome homepage={{ ...homepage, manufacturerCountriesEnabled: false }} />);

    expect(screen.queryByRole('heading', { name: 'کشورهای سازنده' })).not.toBeInTheDocument();
  });
});
