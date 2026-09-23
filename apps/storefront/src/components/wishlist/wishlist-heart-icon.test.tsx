import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WishlistHeartIcon } from '@/components/wishlist/wishlist-heart-icon';

describe('WishlistHeartIcon', () => {
  it('switches from an outline to the animated filled state', () => {
    const { container, rerender } = render(<WishlistHeartIcon active={false} />);

    expect(container.firstElementChild).toHaveAttribute('data-active', 'false');
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'none');

    rerender(<WishlistHeartIcon active />);

    expect(container.firstElementChild).toHaveAttribute('data-active', 'true');
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
  });
});
