import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ShopError from '@/app/(shop)/error';
import ShopLoading from '@/app/(shop)/loading';
import ShopNotFound from '@/app/(shop)/not-found';
import RootError from '@/app/error';
import RootNotFound from '@/app/not-found';

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

  it('uses the branded fallback for URLs outside the shop route group', () => {
    render(<RootNotFound />);
    expect(screen.getByRole('heading', { name: 'صفحه موردنظر پیدا نشد' })).toBeInTheDocument();
  });

  it('can retry a failure outside the shop route group without exposing the error', () => {
    const reset = vi.fn();
    render(<RootError error={new Error('private upstream detail')} reset={reset} />);

    expect(screen.getByRole('alert')).toHaveTextContent('این صفحه فعلاً در دسترس نیست');
    expect(screen.queryByText('private upstream detail')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
