import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KavenegarSmsSender } from './kavenegar-sms.sender';

describe('KavenegarSmsSender', () => {
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'KAVENEGAR_API_KEY') {
        return 'test-api-key';
      }

      if (key === 'KAVENEGAR_OTP_TEMPLATE') {
        return 'login';
      }

      throw new Error(`Unexpected config key: ${key}`);
    }),
  };

  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('sends OTP through Kavenegar VerifyLookup', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        return: {
          status: 200,
        },
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const sender = new KavenegarSmsSender(configService as unknown as ConfigService);

    await sender.sendOtp({
      phone: '+989123456789',
      code: '123456',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];

    expect(url.origin).toBe('https://api.kavenegar.com');
    expect(url.pathname).toBe('/v1/test-api-key/verify/lookup.json');
    expect(url.searchParams.get('receptor')).toBe('09123456789');
    expect(url.searchParams.get('token')).toBe('123456');
    expect(url.searchParams.get('template')).toBe('login');
    expect(options.method).toBe('GET');
  });

  it('does not expose provider errors to API callers', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network error')) as unknown as typeof fetch;

    const sender = new KavenegarSmsSender(configService as unknown as ConfigService);

    await expect(
      sender.sendOtp({
        phone: '+989123456789',
        code: '123456',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
