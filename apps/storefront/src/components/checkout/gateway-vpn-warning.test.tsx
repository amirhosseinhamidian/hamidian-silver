import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GatewayVpnWarning } from './gateway-vpn-warning';

describe('GatewayVpnWarning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not perform a location lookup for non-gateway payments', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<GatewayVpnWarning visible={false} />);

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not show the warning for an Iranian IP', async () => {
    const responseJson = vi.fn().mockResolvedValue({ countryCode: 'IR', isIranian: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: responseJson }));

    render(<GatewayVpnWarning visible />);

    await waitFor(() => expect(responseJson).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('shows the warning for a non-Iranian IP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ countryCode: 'DE', isIranian: false }),
      }),
    );

    render(<GatewayVpnWarning visible />);

    expect(await screen.findByRole('note')).toHaveTextContent(
      'اگر VPN شما روشن است، پیش از رفتن به درگاه بانکی آن را خاموش کنید.',
    );
  });

  it('keeps the safe warning when the country lookup is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<GatewayVpnWarning visible />);

    expect(await screen.findByRole('note')).toBeInTheDocument();
  });
});
