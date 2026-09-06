import type { PublicCatalogMedia } from '@/lib/catalog/public-catalog';

export type CustomerProfile = Readonly<{
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CustomerAddress = Readonly<{
  id: string;
  title: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type CustomerOrderItem = Readonly<{
  id: string;
  variantId: string;
  quantity: number;
  productNameSnapshot: string;
  productSlug: string;
  primaryMedia: PublicCatalogMedia | null;
  fallbackSrc: string | null;
  variantNameSnapshot: string | null;
  skuSnapshot: string;
  sizeLabelSnapshot: string | null;
  platingType: string | null;
  platingWeightGrams: string | null;
  platingRateToman: number | null;
  platingLeadTimeDays: number | null;
  unitWeightGrams: string | null;
  unitSalePriceToman: number;
  unitPlatingPriceToman: number;
  lineTotalToman: number;
  createdAt: string;
}>;

export type CustomerOrder = Readonly<{
  id: string;
  orderNumber: string;
  status: string;
  merchandiseTotalToman: number;
  platingTotalToman: number;
  discountTotalToman: number;
  shippingTotalToman: number;
  taxTotalToman: number;
  grandTotalToman: number;
  trackingCode: string | null;
  reservationExpiresAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: CustomerOrderItem[];
}>;

export type CustomerOrderStatusHistory = Readonly<{
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
}>;

export type CustomerOrderShippingAddress = Readonly<{
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
}>;

export type CustomerOrderDetail = CustomerOrder &
  Readonly<{
    shippingAddress: CustomerOrderShippingAddress;
    statusHistory: CustomerOrderStatusHistory[];
  }>;

export type CustomerOrderList = Readonly<{
  items: CustomerOrder[];
  total: number;
}>;

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export async function readResponseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string | string[];
      error?: { message?: string | string[] };
    };
    const message = payload.error?.message ?? payload.message;
    if (Array.isArray(message)) return message.join('، ');
    if (typeof message === 'string' && message) return message;
  } catch {
    // Fall through to the user-facing fallback.
  }

  return 'امکان انجام درخواست وجود ندارد. دوباره تلاش کنید.';
}
