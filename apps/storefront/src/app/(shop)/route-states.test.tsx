import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ShopError from '@/app/(shop)/error';
import ShopLoading from '@/app/(shop)/loading';
import ShopNotFound from '@/app/(shop)/not-found';

describe('storefront route states', () => {
  it('offers recovery actions when a storefront route fails', () => {
    const reset = vi.fn();

    render(<ShopError error={new Error('request failed')} reset={reset} />);

    expect(screen.getByRole('alert')).toHaveAccessibleName('این صفحه فعلاً در دسترس نیست');
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'بازگشت به صفحه اصلی' })).toHaveAttribute('href', '/');
  });

  it('announces the shared page loading state', () => {
    render(<ShopLoading />);

    expect(screen.getByRole('status')).toHaveTextContent('در حال بارگذاری صفحه');
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders useful navigation for an unknown storefront route', () => {
    render(<ShopNotFound />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'صفحه موردنظر پیدا نشد' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشاهده محصولات' })).toHaveAttribute(
      'href',
      '/products',
    );
  });
});
