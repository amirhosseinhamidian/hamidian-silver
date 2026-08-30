import type { ConfigService } from '@nestjs/config';
import { KavenegarSmsSender } from './kavenegar-sms.sender';

describe('KavenegarSmsSender transactional SMS', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  it('sends a transactional SMS through the generic Kavenegar send endpoint', async () => {
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'KAVENEGAR_API_KEY' ? 'api-key' : 'otp-template',
      ),
      get: jest.fn((key: string, fallback: string) =>
        key === 'KAVENEGAR_SENDER' ? '10004346' : fallback,
      ),
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          return: {
            status: 200,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );
    const sender = new KavenegarSmsSender(config as unknown as ConfigService);

    await sender.sendMessage({
      phone: '+989120000000',
      text: 'Test notification',
    });

    const [url, request] = fetchSpy.mock.calls[0];
    const body = request?.body as URLSearchParams;

    expect(String(url)).toContain('/sms/send.json');
    expect(request?.method).toBe('POST');
    expect(body.get('receptor')).toBe('09120000000');
    expect(body.get('message')).toBe('Test notification');
    expect(body.get('sender')).toBe('10004346');
  });
});
