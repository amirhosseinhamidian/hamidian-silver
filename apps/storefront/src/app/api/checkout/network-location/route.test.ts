import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/checkout/network-location/route';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function requestWithIp(ip: string): Request {
  return new Request('http://storefront.local/api/checkout/network-location', {
    headers: { 'x-real-ip': ip },
  });
}

describe('checkout network location route', () => {
  it('recognizes an Iranian IP without exposing the IP in its response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ip: '2.144.0.1', country: 'ir' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(requestWithIp('2.144.0.1'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ countryCode: 'IR', isIranian: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.country.is/2.144.0.1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('marks a non-Iranian IP for the VPN warning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ country: 'DE' }),
      }),
    );

    const response = await GET(requestWithIp('77.1.2.3'));

    await expect(response.json()).resolves.toEqual({ countryCode: 'DE', isIranian: false });
  });

  it('returns an unknown result when lookup fails or no trusted IP is available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const failedLookup = await GET(requestWithIp('203.0.113.8'));
    const missingIp = await GET(
      new Request('http://storefront.local/api/checkout/network-location'),
    );

    await expect(failedLookup.json()).resolves.toEqual({ countryCode: null, isIranian: null });
    await expect(missingIp.json()).resolves.toEqual({ countryCode: null, isIranian: null });
  });
});
