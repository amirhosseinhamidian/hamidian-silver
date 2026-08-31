import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { SmsDeliveryUnknownError } from '../sms-delivery-unknown.error';
import { KavenegarSmsSender } from './kavenegar-sms.sender';

describe('KavenegarSmsSender transactional SMS', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  function createSender() {
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'KAVENEGAR_API_KEY' ? 'api-key' : 'otp-template',
      ),
      get: jest.fn((key: string, fallback: string) =>
        key === 'KAVENEGAR_SENDER' ? '10004346' : fallback,
      ),
    };

    return new KavenegarSmsSender(config as unknown as ConfigService);
  }

  it('sends a transactional SMS through the generic Kavenegar send endpoint', async () => {
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
    const sender = createSender();

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

  it('marks network failures as an unknown delivery outcome', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('socket closed'));
    const sender = createSender();

    await expect(
      sender.sendMessage({
        phone: '+989120000000',
        text: 'Test notification',
      }),
    ).rejects.toBeInstanceOf(SmsDeliveryUnknownError);
  });

  it('treats a provider 4xx response as a definitive retryable failure', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('Bad request', { status: 400 }));
    const sender = createSender();

    try {
      await sender.sendMessage({
        phone: '+989120000000',
        text: 'Test notification',
      });
      throw new Error('Expected Kavenegar rejection.');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error).not.toBeInstanceOf(SmsDeliveryUnknownError);
    }
  });

  it('marks a malformed successful response as an unknown delivery outcome', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('not-json', { status: 200 }));
    const sender = createSender();

    await expect(
      sender.sendMessage({
        phone: '+989120000000',
        text: 'Test notification',
      }),
    ).rejects.toBeInstanceOf(SmsDeliveryUnknownError);
  });
});
