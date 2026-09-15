import { parseOperationalSeedConfig } from './operational-seed.config';

const BASE_ENV: NodeJS.ProcessEnv = {
  SHIPPING_PROVIDER: 'disabled',
  OPERATIONAL_ADMIN_PHONE: '09123456789',
  OPERATIONAL_CONTACT_ADDRESS: 'تهران، نشانی واقعی فروشگاه',
  OPERATIONAL_CONTACT_PHONES: '02112345678, 09123456789',
};

describe('parseOperationalSeedConfig', () => {
  it('builds a safe manual-shipping configuration with gateways disabled by default', () => {
    const config = parseOperationalSeedConfig(BASE_ENV);

    expect(config.admin.phone).toBe('+989123456789');
    expect(config.paymentGateway).toBeNull();
    expect(config.manualShippingCostToman).toBe(0);
    expect(config.warehouse).toEqual({ code: 'MAIN', name: 'انبار اصلی' });
    expect(config.site.contactPhoneNumbers).toEqual(['02112345678', '09123456789']);
  });

  it('allows exactly one configured gateway to be selected', () => {
    const config = parseOperationalSeedConfig({
      ...BASE_ENV,
      OPERATIONAL_PAYMENT_GATEWAY: 'zarinpal',
      ZARINPAL_MERCHANT_ID: '00000000-0000-4000-8000-000000000001',
      MANUAL_SHIPPING_COST_TOMAN: '85000',
    });

    expect(config.paymentGateway).toBe('zarinpal');
    expect(config.manualShippingCostToman).toBe(85_000);
  });

  it('rejects enabling a gateway without its runtime credentials', () => {
    expect(() =>
      parseOperationalSeedConfig({
        ...BASE_ENV,
        OPERATIONAL_PAYMENT_GATEWAY: 'mellat',
      }),
    ).toThrow(
      'Cannot enable mellat; missing gateway credentials: MELLAT_TERMINAL_ID, MELLAT_USERNAME, MELLAT_PASSWORD.',
    );
  });

  it('rejects Postex while the documented manual shipping policy is active', () => {
    expect(() =>
      parseOperationalSeedConfig({
        ...BASE_ENV,
        SHIPPING_PROVIDER: 'postex',
      }),
    ).toThrow('Operational bootstrap requires SHIPPING_PROVIDER=disabled');
  });

  it('requires real contact data instead of committing placeholders', () => {
    expect(() =>
      parseOperationalSeedConfig({
        ...BASE_ENV,
        OPERATIONAL_CONTACT_ADDRESS: '',
      }),
    ).toThrow('OPERATIONAL_CONTACT_ADDRESS is required');
  });
});
