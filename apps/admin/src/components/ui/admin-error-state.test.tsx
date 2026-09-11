import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminErrorState } from '@/components/ui/admin-error-state';

describe('AdminErrorState', () => {
  it('offers recovery without exposing technical error details', () => {
    const onRetry = vi.fn();
    render(<AdminErrorState onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('بارگذاری پنل انجام نشد');
    expect(screen.getByRole('link', { name: 'ورود دوباره' })).toHaveAttribute('href', '/login');
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
