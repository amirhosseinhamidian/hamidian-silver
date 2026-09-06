import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountDashboard } from '@/components/account/account-dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountDashboard', () => {
  it('renders three prominent tabs and product thumbnails in order history', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'user-1', phone: '+989121234567' }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'user-1',
          phone: '+989121234567',
          firstName: 'امیرحسین',
          lastName: 'حمیدیان',
          phoneVerifiedAt: '2026-09-01T00:00:00.000Z',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        }),
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({
          total: 1,
          items: [
            {
              id: 'order-1',
              orderNumber: 'HS-1001',
              status: 'SHIPPED',
              grandTotalToman: 3_000_000,
              trackingCode: 'POST-123',
              createdAt: '2026-09-05T12:00:00.000Z',
              items: [
                {
                  id: 'item-1',
                  quantity: 1,
                  productNameSnapshot: 'انگشتر نقره مهتاب',
                  productSlug: 'silver-ring',
                  primaryMedia: {
                    url: 'https://media.example/ring.webp',
                    mimeType: 'image/webp',
                    altText: 'انگشتر نقره مهتاب',
                    width: 800,
                    height: 800,
                  },
                  fallbackSrc: null,
                  variantNameSnapshot: 'مدل اصلی',
                  sizeLabelSnapshot: '۷',
                  platingType: null,
                  lineTotalToman: 3_000_000,
                },
              ],
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<AccountDashboard />);

    const tabs = await screen.findAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAccessibleName('سفارش‌ها ۱');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[2]).toHaveAccessibleName('اطلاعات حساب');
    for (const tab of tabs) {
      expect(tab).toHaveClass('text-base', 'font-bold', 'sm:text-lg');
    }

    fireEvent.click(screen.getByRole('tab', { name: /سفارش‌ها/ }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('انگشتر نقره مهتاب')).toBeInTheDocument();
    expect(within(panel).getByRole('img', { name: 'انگشتر نقره مهتاب' })).toHaveAttribute(
      'src',
      'https://media.example/ring.webp',
    );
    expect(within(panel).getByText('POST-۱۲۳')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'آدرس‌ها' }));
    fireEvent.click(screen.getByRole('button', { name: 'افزودن آدرس جدید' }));
    expect(screen.getByTestId('address-form-transition')).toHaveClass(
      'grid-rows-[1fr]',
      'opacity-100',
    );
    expect(screen.getByLabelText(/^عنوان آدرس/)).toHaveAttribute(
      'placeholder',
      'مثلاً خانه یا محل کار',
    );
    fireEvent.click(screen.getByRole('button', { name: 'انصراف' }));
    expect(screen.getByTestId('address-form-transition')).toHaveClass(
      'grid-rows-[0fr]',
      'opacity-0',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'اطلاعات حساب' }));
    expect(screen.getByRole('button', { name: 'خروج از حساب کاربری' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^نام\s*\*?$/)).toHaveAttribute(
      'placeholder',
      'مثلاً امیرحسین',
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });
});
