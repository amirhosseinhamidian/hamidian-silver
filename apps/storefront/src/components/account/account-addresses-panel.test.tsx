import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountAddressesPanel } from '@/components/account/account-addresses-panel';

const address = {
  id: 'address-1',
  title: 'خانه',
  recipientName: 'امیرحسین حمیدیان',
  phone: '09121234567',
  province: 'تهران',
  city: 'تهران',
  addressLine: 'خیابان نمونه، پلاک ۱۲',
  postalCode: '1234567890',
  isDefault: false,
  createdAt: '2026-09-15T08:00:00.000Z',
  updatedAt: '2026-09-15T08:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountAddressesPanel', () => {
  it('uses an accessible modal instead of the browser confirmation dialog', async () => {
    const reloadAddresses = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AccountAddressesPanel
        addresses={[address]}
        profilePhone="09121234567"
        reloadAddresses={reloadAddresses}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'حذف' }));
    const dialog = screen.getByRole('dialog', { name: 'حذف آدرس' });
    expect(within(dialog).getByText(/آدرس «خانه» حذف شود/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'تأیید حذف' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/profile/addresses/address-1', {
        method: 'DELETE',
      }),
    );
    expect(reloadAddresses).toHaveBeenCalledOnce();
  });
});
