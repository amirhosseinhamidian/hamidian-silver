export const SHIPPING_PROVIDER = Symbol('SHIPPING_PROVIDER');

export type ShippingAddressSnapshot = {
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
};

export type ShippingQuoteInput = {
  orderNumber: string;
  totalWeightGrams: string;
  declaredValueToman: number;
  destination: ShippingAddressSnapshot;
};

export type ShippingQuoteOption = {
  serviceCode: string;
  serviceName?: string;
  costToman: number;
  estimatedDeliveryDays?: number;
};

export type CreateProviderShipmentInput = {
  orderNumber: string;
  serviceCode: string;
  totalWeightGrams: string;
  declaredValueToman: number;
  shippingCostToman: number;
  destination: ShippingAddressSnapshot;
};

export type CreateProviderShipmentResult = {
  providerShipmentId: string;
  trackingCode?: string;
};

export type TrackProviderShipmentInput = {
  providerShipmentId: string;
  trackingCode?: string;
};

export type ProviderShipmentTrackingStatus = 'HANDED_OVER' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

export type TrackProviderShipmentResult = {
  providerStatus: string;
  description?: string;
  normalizedStatus?: ProviderShipmentTrackingStatus;
};

export interface ShippingProvider {
  readonly providerCode: string;

  quote(input: ShippingQuoteInput): Promise<ShippingQuoteOption[]>;

  createShipment(input: CreateProviderShipmentInput): Promise<CreateProviderShipmentResult>;

  track(input: TrackProviderShipmentInput): Promise<TrackProviderShipmentResult>;
}
