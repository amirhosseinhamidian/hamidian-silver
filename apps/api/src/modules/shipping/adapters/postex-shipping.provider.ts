import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreateProviderShipmentInput,
  CreateProviderShipmentResult,
  ShippingAddressSnapshot,
  ShippingProvider,
  ShippingQuoteInput,
  ShippingQuoteOption,
  TrackProviderShipmentInput,
  TrackProviderShipmentResult,
} from '../shipping-provider.port';

type PostexBox = {
  id: number;
  height: number;
  width: number;
  length: number;
};

type CityCandidate = {
  id: number;
  provinceMatch: boolean;
};

@Injectable()
export class PostexShippingProvider implements ShippingProvider {
  readonly providerCode = 'postex';

  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly trackingBaseUrl: string;
  private readonly originCityCode: number;
  private readonly originCityName: string;
  private readonly originPostalCode: string;
  private readonly originAddress: string;
  private readonly originFirstName: string;
  private readonly originLastName: string;
  private readonly originMobile: string;
  private readonly originPhone: string;
  private readonly originCompanyName: string;
  private readonly boxTypeId: number;
  private readonly collectionType: string;
  private readonly paymentType: 'SENDER' | 'RECEIVER';
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('POSTEX_API_KEY', '');
    this.apiBaseUrl = this.trimTrailingSlash(
      this.config.get<string>('POSTEX_API_BASE_URL', 'https://api.postex.ir/api/v1'),
    );
    this.trackingBaseUrl = this.trimTrailingSlash(
      this.config.get<string>('POSTEX_TRACKING_BASE_URL', 'https://api.postex.ir/api/app/v1'),
    );
    this.originCityCode = this.config.get<number>('POSTEX_ORIGIN_CITY_CODE', 0);
    this.originCityName = this.config.get<string>('POSTEX_ORIGIN_CITY_NAME', '');
    this.originPostalCode = this.config.get<string>('POSTEX_ORIGIN_POSTAL_CODE', '');
    this.originAddress = this.config.get<string>('POSTEX_ORIGIN_ADDRESS', '');
    this.originFirstName = this.config.get<string>('POSTEX_ORIGIN_FIRST_NAME', '');
    this.originLastName = this.config.get<string>('POSTEX_ORIGIN_LAST_NAME', '');
    this.originMobile = this.config.get<string>('POSTEX_ORIGIN_MOBILE', '');
    this.originPhone = this.config.get<string>('POSTEX_ORIGIN_PHONE', '');
    this.originCompanyName = this.config.get<string>('POSTEX_ORIGIN_COMPANY_NAME', '');
    this.boxTypeId = this.config.get<number>('POSTEX_BOX_TYPE_ID', 0);
    this.collectionType = this.config.get<string>('POSTEX_COLLECTION_TYPE', '');
    this.paymentType = this.config.get<'SENDER' | 'RECEIVER'>('POSTEX_PAYMENT_TYPE', 'SENDER');
    this.timeoutMs = this.config.get<number>('POSTEX_REQUEST_TIMEOUT_MS', 15_000);
  }

  async quote(input: ShippingQuoteInput): Promise<ShippingQuoteOption[]> {
    this.assertConfigured();

    const [destinationCityCode, box] = await Promise.all([
      this.resolveDestinationCityCode(input.destination),
      this.resolveBox(),
    ]);
    const declaredValueRial = this.tomanToRialNumber(input.declaredValueToman);
    const totalWeight = this.parsePositiveNumber(input.totalWeightGrams, 'shipment weight');

    const response = await this.requestJson(`${this.apiBaseUrl}/shipping/quotes`, {
      method: 'POST',
      body: {
        from_city_code: this.originCityCode,
        coupon_code: '',
        collection_type: this.collectionType,
        courier: {
          courier_code: '',
          service_type: '',
        },
        parcels: [
          {
            custom_parcel_id: input.orderNumber,
            to_city_code: destinationCityCode,
            payment_type: this.paymentType,
            parcel_properties: {
              height: box.height,
              width: box.width,
              length: box.length,
              box_type_id: box.id,
              is_fragile: false,
              is_liquid: false,
              total_weight: totalWeight,
              total_value: declaredValueRial,
              total_value_currency: 'IRR',
            },
          },
        ],
        value_added_service: {
          handling_fee: 0,
          request_label: false,
          request_packaging: false,
          request_sms_notification: false,
          optional_insurance: false,
          request_email_notification: false,
          print_logo: false,
        },
        channel: 'hamidian-silver',
        appName: 'api',
      },
    });

    const root = this.asRecord(response);
    const shippingPrices = this.asArray(root.shipping_prices);
    const firstParcel = this.asRecord(shippingPrices[0]);
    const servicePrices = this.asArray(firstParcel.service_price);
    const pickupPriceRial = this.readNonNegativeInteger(root.pickup_price, 0);

    if (servicePrices.length === 0) {
      throw new BadGatewayException('Postex returned no shipping services.');
    }

    return servicePrices.map((raw) => {
      const service = this.asRecord(raw);
      const courierCode = this.readRequiredString(service.courierCode, 'courierCode');
      const serviceType = this.readRequiredString(service.serviceType, 'serviceType');
      const serviceName = this.readOptionalString(service.serviceName);
      const totalPriceRial = this.readNonNegativeInteger(service.totalPrice);
      const slaDays = this.readOptionalNonNegativeInteger(service.slaDays);

      return {
        serviceCode: `${courierCode}|${serviceType}`,
        serviceName,
        costToman: this.rialToToman(totalPriceRial + pickupPriceRial),
        estimatedDeliveryDays: slaDays,
      };
    });
  }

  async createShipment(input: CreateProviderShipmentInput): Promise<CreateProviderShipmentResult> {
    this.assertConfigured();

    const [courierCode, serviceType] = this.parseServiceCode(input.serviceCode);
    const [destinationCityCode, box] = await Promise.all([
      this.resolveDestinationCityCode(input.destination),
      this.resolveBox(),
    ]);
    const declaredValueRial = this.tomanToRialNumber(input.declaredValueToman);
    const totalWeight = this.parsePositiveNumber(input.totalWeightGrams, 'shipment weight');
    const recipient = this.splitRecipientName(input.destination.recipientName);
    const destinationMobile = this.toPostexMobile(input.destination.phone);
    const originMobile = this.toPostexMobile(this.originMobile);

    const response = await this.requestJson(`${this.apiBaseUrl}/parcels/bulk`, {
      method: 'POST',
      body: {
        custom_batch_no: input.orderNumber,
        collection_type: this.collectionType,
        custom_channel: 'hamidian-silver',
        submit_source: 'api',
        parcels: [
          {
            from: {
              contact: {
                first_name: this.originFirstName,
                last_name: this.originLastName,
                mobile_no: originMobile,
                telephone_no: this.originPhone || originMobile,
                email_address: '',
                company_name: this.originCompanyName,
                national_code: '',
              },
              location: {
                post_code: this.originPostalCode,
                country: 'IR',
                city_id: this.originCityCode,
                city_name: this.originCityName,
                address: this.originAddress,
                lat: '',
                lon: '',
              },
            },
            to: {
              contact: {
                first_name: recipient.firstName,
                last_name: recipient.lastName,
                mobile_no: destinationMobile,
                telephone_no: destinationMobile,
              },
              location: {
                post_code: input.destination.postalCode,
                city_id: destinationCityCode,
                city_name: input.destination.city,
                address: input.destination.addressLine,
              },
            },
            parcel_items: [
              {
                description: `Order ${input.orderNumber}`,
                sku: input.orderNumber,
                quantity: 1,
                price: declaredValueRial,
              },
            ],
            parcel_properties: {
              length: box.length,
              width: box.width,
              height: box.height,
              total_weight: totalWeight,
              is_fragile: false,
              is_liquid: false,
              total_value: declaredValueRial,
              total_value_currency: 'IRR',
              box_type_id: box.id,
            },
            courier: {
              name: courierCode,
              service_type: serviceType,
              payment_type: this.paymentType,
            },
            added_service: {
              handling_fee: 0,
              request_label: false,
              request_packaging: false,
              request_sms_notification: false,
              request_email_notification: false,
              print_logo: false,
            },
            delivery_instructions: '',
            custom_order_no: null,
            custom_reference_no: input.orderNumber,
            submit_channel: 'api',
            ready_to_accept: false,
            drop_off_location: '',
          },
        ],
      },
    });

    const root = this.asRecord(response);
    const results = this.asArray(root.result);
    const firstResult = this.asRecord(results[0]);

    if (firstResult.isSuccess === false) {
      throw new BadGatewayException(
        this.readOptionalString(firstResult.message) ?? 'Postex rejected the shipment request.',
      );
    }

    const data = this.asRecord(firstResult.data);
    const shipments = this.asArray(data.shipments);
    const shipment = this.asRecord(shipments[0]);
    const tracking = this.asRecord(shipment.tracking);
    const parcelNumber = this.readRequiredString(data.parcel_no, 'parcel_no');
    const trackingCode = this.readOptionalString(tracking.barcode);

    return {
      providerShipmentId: parcelNumber,
      trackingCode,
    };
  }

  async track(input: TrackProviderShipmentInput): Promise<TrackProviderShipmentResult> {
    this.assertConfigured();

    if (!input.trackingCode) {
      throw new BadGatewayException('Postex tracking requires a tracking code.');
    }

    const response = await this.requestJson(
      `${this.trackingBaseUrl}/tracking/public/${encodeURIComponent(input.trackingCode)}`,
      {
        method: 'GET',
      },
    );
    const root = this.asRecord(response);
    const events = this.asArray(root.events);

    if (events.length === 0) {
      return {
        providerStatus: 'NO_EVENTS',
        description: 'Postex returned no tracking events.',
      };
    }

    const latest = this.asRecord(events.at(-1));
    const providerStatus = this.readOptionalString(latest.description) ?? 'UNKNOWN';
    const location = this.readOptionalString(latest.location);
    const eventDate =
      this.readOptionalString(latest.local_event_date) ??
      this.readOptionalString(latest.friendly_event_date);
    const eventTime = this.readOptionalString(latest.event_time);

    return {
      providerStatus,
      description: [location, eventDate, eventTime].filter(Boolean).join(' | ') || undefined,
    };
  }

  private async resolveDestinationCityCode(destination: ShippingAddressSnapshot): Promise<number> {
    const response = await this.requestJson(`${this.apiBaseUrl}/locality/cities/all`, {
      method: 'GET',
    });
    const matches: CityCandidate[] = [];
    const targetCity = this.normalizeLocationName(destination.city);
    const targetProvince = this.normalizeLocationName(destination.province);

    this.collectCityCandidates(response, [], targetCity, targetProvince, matches);

    const provinceMatches = matches.filter((candidate) => candidate.provinceMatch);

    if (provinceMatches.length > 0) {
      return provinceMatches[0].id;
    }

    if (matches.length === 1) {
      return matches[0].id;
    }

    throw new BadGatewayException(
      `Postex city code could not be resolved for ${destination.province}/${destination.city}.`,
    );
  }

  private collectCityCandidates(
    value: unknown,
    ancestors: string[],
    targetCity: string,
    targetProvince: string,
    matches: CityCandidate[],
  ): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectCityCandidates(item, ancestors, targetCity, targetProvince, matches);
      }

      return;
    }

    if (!this.isRecord(value)) {
      return;
    }

    const record = value;
    const ownName = this.firstString(record, ['name', 'city_name', 'cityName', 'title']);
    const ownProvince = this.firstString(record, [
      'province',
      'province_name',
      'provinceName',
      'state_name',
      'stateName',
    ]);
    const id = this.firstInteger(record, ['id', 'city_id', 'cityId', 'code']);

    if (ownName && id !== undefined && this.normalizeLocationName(ownName) === targetCity) {
      const contextNames = [...ancestors, ownProvince ?? '']
        .map((name) => this.normalizeLocationName(name))
        .filter(Boolean);

      matches.push({
        id,
        provinceMatch: contextNames.includes(targetProvince),
      });
    }

    const nextAncestors = ownName ? [...ancestors, ownName] : ancestors;

    for (const child of Object.values(record)) {
      if (Array.isArray(child) || this.isRecord(child)) {
        this.collectCityCandidates(child, nextAncestors, targetCity, targetProvince, matches);
      }
    }
  }

  private async resolveBox(): Promise<PostexBox> {
    const response = await this.requestJson(`${this.apiBaseUrl}/common/boxes`, {
      method: 'GET',
    });
    const box = this.findRecordByIntegerId(response, this.boxTypeId);

    if (!box) {
      throw new BadGatewayException('Configured Postex box type was not found.');
    }

    return {
      id: this.boxTypeId,
      height: this.readPositiveNumber(box.height, 'box height'),
      width: this.readPositiveNumber(box.width, 'box width'),
      length: this.readPositiveNumber(box.length, 'box length'),
    };
  }

  private findRecordByIntegerId(
    value: unknown,
    expectedId: number,
  ): Record<string, unknown> | undefined {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findRecordByIntegerId(item, expectedId);

        if (found) {
          return found;
        }
      }

      return undefined;
    }

    if (!this.isRecord(value)) {
      return undefined;
    }

    const id = this.firstInteger(value, ['id']);

    if (id === expectedId) {
      return value;
    }

    for (const child of Object.values(value)) {
      if (Array.isArray(child) || this.isRecord(child)) {
        const found = this.findRecordByIntegerId(child, expectedId);

        if (found) {
          return found;
        }
      }
    }

    return undefined;
  }

  private async requestJson(
    url: string,
    options: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
    },
  ): Promise<unknown> {
    try {
      const response = await fetch(url, {
        method: options.method,
        headers: {
          'x-api-key': this.apiKey,
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new BadGatewayException(
          this.extractPostexError(payload) ?? `Postex returned HTTP ${response.status}.`,
        );
      }

      if (this.isRecord(payload)) {
        const isSuccess = payload.isSuccess ?? payload.IsSuccess;

        if (isSuccess === false) {
          throw new BadGatewayException(
            this.extractPostexError(payload) ?? 'Postex rejected the request.',
          );
        }
      }

      return payload;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new ServiceUnavailableException('Postex is currently unavailable.');
    }
  }

  private extractPostexError(payload: unknown): string | undefined {
    if (!this.isRecord(payload)) {
      return undefined;
    }

    return (
      this.readOptionalString(payload.message) ??
      this.readOptionalString(payload.Message) ??
      this.readOptionalString(payload.error)
    );
  }

  private assertConfigured(): void {
    if (
      !this.apiKey ||
      this.originCityCode <= 0 ||
      !this.originCityName ||
      !this.originPostalCode ||
      !this.originAddress ||
      !this.originFirstName ||
      !this.originLastName ||
      !this.originMobile ||
      this.boxTypeId <= 0 ||
      !this.collectionType
    ) {
      throw new ServiceUnavailableException('Postex shipping is not fully configured.');
    }
  }

  private parseServiceCode(serviceCode: string): [string, string] {
    const [courierCode, serviceType, ...extra] = serviceCode.split('|');

    if (!courierCode || !serviceType || extra.length > 0) {
      throw new BadGatewayException('Invalid Postex shipping service code.');
    }

    return [courierCode, serviceType];
  }

  private splitRecipientName(value: string): {
    firstName: string;
    lastName: string;
  } {
    const parts = value.trim().split(/\s+/);

    if (parts.length === 1) {
      return {
        firstName: parts[0],
        lastName: '-',
      };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private toPostexMobile(value: string): string {
    const digits = value.replace(/\D/g, '');

    if (/^09\d{9}$/.test(digits)) {
      return digits;
    }

    if (/^989\d{9}$/.test(digits)) {
      return `0${digits.slice(2)}`;
    }

    if (/^9\d{9}$/.test(digits)) {
      return `0${digits}`;
    }

    throw new BadGatewayException('Invalid Iranian mobile number for Postex.');
  }

  private tomanToRialNumber(amountToman: number): number {
    if (!Number.isSafeInteger(amountToman) || amountToman < 0) {
      throw new BadGatewayException('Invalid declared value for Postex.');
    }

    const rial = BigInt(amountToman) * 10n;

    if (rial > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new BadGatewayException('Declared Rial value exceeds the supported range.');
    }

    return Number(rial);
  }

  private rialToToman(amountRial: number): number {
    if (!Number.isSafeInteger(amountRial) || amountRial < 0) {
      throw new BadGatewayException('Invalid Rial price returned by Postex.');
    }

    return Math.ceil(amountRial / 10);
  }

  private parsePositiveNumber(value: string, label: string): number {
    if (!/^\d+(?:\.\d{1,3})?$/.test(value)) {
      throw new BadGatewayException(`Invalid ${label} for Postex.`);
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadGatewayException(`Invalid ${label} for Postex.`);
    }

    return parsed;
  }

  private readPositiveNumber(value: unknown, label: string): number {
    const parsed =
      typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadGatewayException(`Postex returned an invalid ${label}.`);
    }

    return parsed;
  }

  private readNonNegativeInteger(value: unknown, fallback?: number): number {
    if (value === undefined || value === null || value === '') {
      if (fallback !== undefined) {
        return fallback;
      }

      throw new BadGatewayException('Postex returned an invalid price.');
    }

    const normalized = typeof value === 'string' ? value.replaceAll(',', '') : value;
    const parsed =
      typeof normalized === 'number'
        ? normalized
        : typeof normalized === 'string'
          ? Number(normalized)
          : Number.NaN;

    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new BadGatewayException('Postex returned an invalid price.');
    }

    return parsed;
  }

  private readOptionalNonNegativeInteger(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = typeof value === 'number' ? value : Number(value);

    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }

  private readRequiredString(value: unknown, field: string): string {
    const parsed = this.readOptionalString(value);

    if (!parsed) {
      throw new BadGatewayException(`Postex response is missing ${field}.`);
    }

    return parsed;
  }

  private readOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.readOptionalString(record[key]);

      if (value) {
        return value;
      }
    }

    return undefined;
  }

  private firstInteger(record: Record<string, unknown>, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = record[key];
      const parsed = typeof value === 'number' ? value : Number(value);

      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return undefined;
  }

  private normalizeLocationName(value: string): string {
    return value
      .normalize('NFKC')
      .replaceAll('ي', 'ی')
      .replaceAll('ك', 'ک')
      .replace(/[\s‌]+/g, '')
      .trim();
  }

  private trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
