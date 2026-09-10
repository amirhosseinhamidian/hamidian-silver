import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminProfileCompletionGate } from '@/components/auth/admin-profile-completion-gate';

const navigationMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: navigationMocks.refresh }),
}));

describe('AdminProfileCompletionGate', () => {
  afterEach(() => {
    navigationMocks.refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it('does not interrupt administrators whose profile is complete', () => {
    render(<AdminProfileCompletionGate profile={{ firstName: 'امیرحسین', lastName: 'حمیدیان' }} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps an incomplete profile dialog open until both names are saved', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        firstName: 'امیرحسین',
        lastName: 'حمیدیان',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminProfileCompletionGate profile={{ firstName: null, lastName: null }} />);

    const dialog = screen.getByRole('dialog', { name: 'تکمیل اطلاعات مدیر' });
    expect(screen.queryByRole('button', { name: 'بستن' })).not.toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'تکمیل اطلاعات مدیر' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ذخیره و ورود به پنل' }));
    expect(await screen.findByText('نام را وارد کنید.')).toBeInTheDocument();
    expect(screen.getByText('نام خانوادگی را وارد کنید.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('مثلاً امیرحسین'), {
      target: { value: '  امیرحسین  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('مثلاً حمیدیان'), {
      target: { value: '  حمیدیان  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره و ورود به پنل' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'امیرحسین', lastName: 'حمیدیان' }),
      });
      expect(navigationMocks.refresh).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
