import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminSessionMonitor } from '@/components/auth/admin-session-monitor';

describe('AdminSessionMonitor', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('requires a fresh login after a protected BFF returns 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminSessionMonitor />);

    await fetch('/api/orders/order-1/status', { method: 'PATCH' });

    const dialog = await screen.findByRole('dialog', {
      name: 'نشست مدیریتی منقضی شده است',
    });
    expect(dialog).toHaveTextContent('وضعیت عملیات را پیش از تکرار بررسی کنید');
    expect(screen.getByRole('link', { name: 'ورود دوباره' })).toHaveAttribute(
      'href',
      '/login?next=%2F',
    );

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'نشست مدیریتی منقضی شده است' })).toBeInTheDocument();
  });

  it('does not intercept authentication endpoint responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminSessionMonitor />);

    await fetch('/api/auth/logout', { method: 'POST' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
