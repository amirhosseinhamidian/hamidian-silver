import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProductMediaGallery } from '@/components/catalog/product-media-gallery';
import type { PublicCatalogMedia } from '@/lib/catalog/public-catalog';

const media: PublicCatalogMedia[] = [
  {
    url: 'https://media.hamidian.test/products/ring-front.webp',
    mimeType: 'image/webp',
    altText: 'نمای روبه‌رو',
    width: 1200,
    height: 1500,
  },
  {
    url: 'https://media.hamidian.test/products/ring-side.webp',
    mimeType: 'image/webp',
    altText: 'نمای کنار',
    width: 1200,
    height: 1500,
  },
];

describe('ProductMediaGallery', () => {
  it('renders an inline mobile carousel with controls and indicators', () => {
    render(<ProductMediaGallery productName="انگشتر نقره" media={media} />);

    const gallery = screen.getByTestId('mobile-product-gallery');
    expect(gallery).toHaveAttribute('aria-roledescription', 'carousel');
    expect(screen.getByRole('button', { name: 'نمایش تصویر ۱' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'تصویر بعدی گالری محصول' }));

    expect(screen.getByRole('button', { name: 'نمایش تصویر ۲' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('supports touch swiping without opening the desktop zoom dialog', () => {
    render(<ProductMediaGallery productName="انگشتر نقره" media={media} />);

    const gallery = screen.getByTestId('mobile-product-gallery');
    fireEvent.touchStart(gallery, { changedTouches: [{ clientX: 180 }] });
    fireEvent.touchEnd(gallery, { changedTouches: [{ clientX: 80 }] });

    expect(screen.getByRole('button', { name: 'نمایش تصویر ۲' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables carousel behavior when only one image exists', () => {
    render(<ProductMediaGallery productName="انگشتر نقره" media={[media[0]!]} />);

    const gallery = screen.getByTestId('mobile-product-gallery');
    expect(gallery).not.toHaveAttribute('aria-roledescription');
    expect(
      screen.queryByRole('button', { name: 'تصویر قبلی گالری محصول' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'تصویر بعدی گالری محصول' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('product-gallery-indicators')).not.toBeInTheDocument();
  });
});
