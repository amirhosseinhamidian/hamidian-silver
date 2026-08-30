import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PostexShippingProvider } from './postex-shipping.provider';

describe('PostexShippingProvider', () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  function createProvider() {
    const values: Record<string, unknown> = {
      POSTEX_API_KEY: 'postex-test-api-key',
      POSTEX_API_BASE_URL: 'https://api.postex.ir/api/v1',
      POSTEX_TRACKING_BASE_URL: 'https://api.postex.ir/api/app/v1',
      POSTEX_ORIGIN_CITY_CODE: 1,
      POSTEX_ORIGIN_CITY_NAME: 'تهران',
      POSTEX_ORIGIN_POSTAL_CODE: '1234567890',
      POSTEX_ORIGIN_ADDRESS: 'Origin address',
      POSTEX_ORIGIN_FIRST_NAME: 'Store',
      POSTEX_ORIGIN_LAST_NAME: 'Owner',
      POSTEX_ORIGIN_MOBILE: '+989123456789',
      POSTEX_ORIGIN_PHONE: '',
      POSTEX_ORIGIN_COMPANY_NAME: 'Hamidian Silver',
      POSTEX_BOX_TYPE_ID: 7,
      POSTEX_COLLECTION_TYPE: 'TEST_COLLECTION',
      POSTEX_PAYMENT_TYPE: 'SENDER',
      POSTEX_REQUEST_TIMEOUT_MS: 15000,
    };
    const config = {
      get: jest.fn((key: string, defaultValue: unknown) => values[key] ?? defaultValue),
    };

    return new PostexShippingProvider(config as unknown as ConfigService);
  }

  const destination = {
    recipientName: 'Ali Ahmadi',
    phone: '+989111111111',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'Destination address',
    postalCode: '0987654321',
  };

  function mockReferenceCalls() {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 1,
              name: 'تهران',
              cities: [{ id: 101, name: 'تهران' }],
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 7,
              height: 10,
              width: 12,
              length: 20,
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
  }

  it('quotes Postex services and converts returned Rial prices to Toman', async () => {
    mockReferenceCalls();
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pickup_price: 50000,
          shipping_prices: [
            {
              custom_parcel_id: 'HS-TEST',
              service_price: [
                {
                  courierCode: 'IR_POST',
                  serviceType: 'EXPRESS',
                  serviceName: 'پست پیشتاز',
                  slaDays: 3,
                  initPrice: 1100000,
                  totalPrice: 1000000,
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const provider = createProvider();

    await expect(
      provider.quote({
        orderNumber: 'HS-TEST',
        totalWeightGrams: '10.500',
        declaredValueToman: 1_200_000,
        destination,
      }),
    ).resolves.toEqual([
      {
        serviceCode: 'IR_POST|EXPRESS',
        serviceName: 'پست پیشتاز',
        costToman: 105000,
        estimatedDeliveryDays: 3,
      },
    ]);

    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://api.postex.ir/api/v1/shipping/quotes',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'postex-test-api-key',
        }),
        body: expect.stringContaining('"total_value":12000000'),
      }),
    );
  });

  it('creates a Postex parcel and returns parcel number plus tracking barcode', async () => {
    mockReferenceCalls();
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          result: [
            {
              isSuccess: true,
              data: {
                parcel_no: 'PX-1001',
                shipments: [
                  {
                    tracking: {
                      barcode: 'TRACK-1001',
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const provider = createProvider();

    await expect(
      provider.createShipment({
        orderNumber: 'HS-TEST',
        serviceCode: 'IR_POST|EXPRESS',
        totalWeightGrams: '10.500',
        declaredValueToman: 1_200_000,
        shippingCostToman: 105_000,
        destination,
      }),
    ).resolves.toEqual({
      providerShipmentId: 'PX-1001',
      trackingCode: 'TRACK-1001',
    });

    const createCall = fetchSpy.mock.calls.at(-1);
    const requestBody = JSON.parse(
      (createCall?.[1] as RequestInit | undefined)?.body as string,
    ) as {
      parcels: Array<{
        courier: { name: string; service_type: string; payment_type: string };
        from: { contact: { mobile_no: string } };
        to: { contact: { mobile_no: string } };
      }>;
    };

    expect(requestBody.parcels[0].courier).toEqual({
      name: 'IR_POST',
      service_type: 'EXPRESS',
      payment_type: 'SENDER',
    });
    expect(requestBody.parcels[0].from.contact.mobile_no).toBe('09123456789');
    expect(requestBody.parcels[0].to.contact.mobile_no).toBe('09111111111');
  });

  it('reads the latest tracking event from the public Postex tracking endpoint', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          events: [
            {
              description: 'پذیرش مرسوله',
              location: 'تهران',
            },
            {
              description: 'تحویل به گیرنده',
              location: 'تهران',
              local_event_date: '1405/06/08',
              event_time: '16:30',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const provider = createProvider();

    await expect(
      provider.track({
        providerShipmentId: 'PX-1001',
        trackingCode: 'TRACK-1001',
      }),
    ).resolves.toEqual({
      providerStatus: 'تحویل به گیرنده',
      description: 'تهران | 1405/06/08 | 16:30',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.postex.ir/api/app/v1/tracking/public/TRACK-1001',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('maps provider transport failures to service unavailable', async () => {
    fetchSpy.mockRejectedValue(new Error('network unavailable'));

    const provider = createProvider();

    await expect(
      provider.track({
        providerShipmentId: 'PX-1001',
        trackingCode: 'TRACK-1001',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects malformed provider service codes before creating a parcel', async () => {
    const provider = createProvider();

    await expect(
      provider.createShipment({
        orderNumber: 'HS-TEST',
        serviceCode: 'INVALID',
        totalWeightGrams: '10.500',
        declaredValueToman: 1_200_000,
        shippingCostToman: 105_000,
        destination,
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
