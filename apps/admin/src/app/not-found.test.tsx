import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AdminNotFound from '@/app/not-found';
import DashboardNotFound from '@/app/(dashboard)/not-found';

describe('admin unmatched routes', () => {
  it('offers a branded page without requiring a working API or a dashboard session', () => {
    render(<AdminNotFound />);

    expect(
      screen.getByRole('heading', { name: 'این صفحه در پنل مدیریت پیدا نشد' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'بازگشت به داشبورد' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'ورود به پنل' })).toHaveAttribute('href', '/login');
  });

  it('keeps a separate recovery state inside the authenticated dashboard shell', () => {
    render(<DashboardNotFound />);
    expect(screen.getByRole('heading', { name: 'این بخش از پنل پیدا نشد' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'بازگشت به داشبورد' })).toHaveAttribute('href', '/');
  });
});
