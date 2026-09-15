import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PaymentGatewaySettingsView } from '@/components/payment-gateways/payment-gateway-settings-view';
import type { AdminPaymentGatewaySetting } from '@/lib/payment-gateways/payment-gateway-model';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const settings: readonly AdminPaymentGatewaySetting[] = [
  {
    provider: 'zarinpal',
    displayName: 'زرین‌پال',
    sortOrder: 10,
    isEnabled: true,
    isImplemented: true,
    isConfigured: true,
    isAvailable: true,
    updatedAt: '2026-09-08T09:00:00.000Z',
  },
  {
    provider: 'zibal',
    displayName: 'زیبال',
    sortOrder: 20,
    isEnabled: false,
    isImplemented: true,
    isConfigured: true,
    isAvailable: false,
    updatedAt: null,
  },
  {
    provider: 'mellat',
    displayName: 'درگاه مستقیم بانک ملت',
    sortOrder: 30,
    isEnabled: false,
    isImplemented: true,
    isConfigured: false,
    isAvailable: false,
    updatedAt: null,
  },
];

describe('PaymentGatewaySettingsView', () => {
  it('shows operational state and keeps unconfigured gateways unavailable', () => {
    render(<PaymentGatewaySettingsView initialSettings={settings} failed={false} canWrite />);

    expect(screen.getByRole('region', { name: 'فهرست درگاه‌های پرداخت' })).toBeInTheDocument();
    expect(screen.getByText('ZARINPAL_MERCHANT_ID')).toBeInTheDocument();
    expect(screen.getByText('MELLAT_PASSWORD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'فعال‌کردن درگاه مستقیم بانک ملت' })).toBeDisabled();
    expect(screen.getAllByText('آماده پرداخت')).toHaveLength(1);
    expect(screen.getAllByText('نیازمند پیکربندی')).toHaveLength(1);
  });

  it('activates a configured gateway through the same-origin BFF', async () => {
    const updated = { ...settings[1], isEnabled: true, isAvailable: true };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<PaymentGatewaySettingsView initialSettings={settings} failed={false} canWrite />);

    fireEvent.click(screen.getByRole('button', { name: 'فعال‌کردن زیبال' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/payment-gateways/zibal',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: true }),
      }),
    );
    expect(await screen.findByText('زیبال برای پرداخت مشتری فعال شد.')).toBeInTheDocument();
    expect(screen.getAllByText('آماده پرداخت')).toHaveLength(2);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('is read-only without settings.write permission', () => {
    render(
      <PaymentGatewaySettingsView initialSettings={settings} failed={false} canWrite={false} />,
    );
    const list = screen.getByRole('region', { name: 'فهرست درگاه‌های پرداخت' });
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
    expect(within(list).getAllByText('فقط مشاهده')).toHaveLength(3);
  });

  it('shows a clear failure state when gateway settings cannot be loaded', () => {
    render(<PaymentGatewaySettingsView initialSettings={null} failed canWrite />);
    expect(screen.getByRole('alert')).toHaveTextContent('دریافت تنظیمات درگاه ناموفق بود');
  });
});
