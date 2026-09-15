import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StorefrontImage } from '@/components/media/storefront-image';

describe('StorefrontImage', () => {
  it('shows a local accessible image when the public media request fails', () => {
    const { rerender } = render(
      <StorefrontImage
        src="https://media.hamidian.shop/ring.webp"
        alt="انگشتر نقره"
        width={200}
        height={200}
      />,
    );
    const image = screen.getByRole('img', { name: 'انگشتر نقره' });
    fireEvent.error(image);

    expect(image).toHaveAttribute('src', '/images/image-unavailable.svg');
    expect(image).toHaveAttribute('alt', 'انگشتر نقره');
    expect(image).toHaveAttribute('width', '200');

    rerender(
      <StorefrontImage
        src="https://media.hamidian.shop/other.webp"
        alt="انگشتر نقره"
        width={200}
        height={200}
      />,
    );
    expect(image).toHaveAttribute('src', 'https://media.hamidian.shop/other.webp');
  });
});
