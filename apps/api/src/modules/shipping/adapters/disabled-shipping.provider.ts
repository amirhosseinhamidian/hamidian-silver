import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  CreateProviderShipmentInput,
  CreateProviderShipmentResult,
  ShippingProvider,
  ShippingQuoteInput,
  ShippingQuoteOption,
  TrackProviderShipmentInput,
  TrackProviderShipmentResult,
} from '../shipping-provider.port';

@Injectable()
export class DisabledShippingProvider implements ShippingProvider {
  readonly providerCode = 'disabled';

  quote(_input: ShippingQuoteInput): Promise<ShippingQuoteOption[]> {
    throw new ServiceUnavailableException('Shipping provider is not configured.');
  }

  createShipment(_input: CreateProviderShipmentInput): Promise<CreateProviderShipmentResult> {
    throw new ServiceUnavailableException('Shipping provider is not configured.');
  }

  track(_input: TrackProviderShipmentInput): Promise<TrackProviderShipmentResult> {
    throw new ServiceUnavailableException('Shipping provider is not configured.');
  }
}
