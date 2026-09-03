import { CatalogMedia } from '@/components/catalog/catalog-media';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('CatalogMedia', () => {
  it('renders a configured public catalog image', () => {
    render(
      <CatalogMedia
        media={{
          url: 'https://media.hamidian.shop/products/ring.jpg',
          mimeType: 'image/jpeg',
          altText: 'انگشتر نقره',
          width: 800,
          height: 1000,
        }}
        alt="محصول"
      />,
    );

    expect(screen.getByRole('img', { name: 'انگشتر نقره' })).toHaveAttribute(
      'src',
      'https://media.hamidian.shop/products/ring.jpg',
    );
  });

  it('falls back to accessible text when no public image URL is available', () => {
    render(
      <CatalogMedia
        media={{
          url: null,
          mimeType: 'image/jpeg',
          altText: null,
          width: null,
          height: null,
        }}
        alt="انگشتر نقره"
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('انگشتر نقره')).toBeInTheDocument();
  });
});
