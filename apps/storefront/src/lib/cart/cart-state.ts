export type CartPlatingType = 'GOLD' | 'RHODIUM';

export type CartVariantAttribute = Readonly<{
  name: string;
  value: string;
}>;

export type CartMediaSnapshot = Readonly<{
  url: string | null;
  mimeType: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}>;

export type CartItem = Readonly<{
  key: string;
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  media: CartMediaSnapshot | null;
  unitSalePriceToman: number;
  platingType: CartPlatingType | null;
  unitPlatingPriceToman: number;
  platingLeadTimeDays: number;
  quantity: number;
  maxQuantity: number;
}>;

export type AddCartItemInput = Omit<CartItem, 'key'>;

const MAX_CART_LINES = 100;
const MAX_LINE_QUANTITY = 99;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableDimension(value: unknown): value is number | null {
  return value === null || isNonNegativeSafeInteger(value);
}

function normalizeMedia(value: unknown): CartMediaSnapshot | null | undefined {
  if (value === null) {
    return null;
  }

  if (
    !isRecord(value) ||
    !isNullableString(value.url) ||
    typeof value.mimeType !== 'string' ||
    !value.mimeType ||
    !isNullableString(value.altText) ||
    !isNullableDimension(value.width) ||
    !isNullableDimension(value.height)
  ) {
    return undefined;
  }

  return {
    url: value.url,
    mimeType: value.mimeType,
    altText: value.altText,
    width: value.width,
    height: value.height,
  };
}

function normalizePlatingType(value: unknown): CartPlatingType | null | undefined {
  if (value === null) {
    return null;
  }

  return value === 'GOLD' || value === 'RHODIUM' ? value : undefined;
}

function normalizeStoredCartItem(value: unknown): CartItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const media = normalizeMedia(value.media);
  const platingType = normalizePlatingType(value.platingType);

  if (
    typeof value.variantId !== 'string' ||
    !value.variantId ||
    typeof value.productSlug !== 'string' ||
    !value.productSlug ||
    typeof value.productName !== 'string' ||
    !value.productName ||
    typeof value.variantLabel !== 'string' ||
    !value.variantLabel ||
    media === undefined ||
    platingType === undefined ||
    !isNonNegativeSafeInteger(value.unitSalePriceToman) ||
    !isNonNegativeSafeInteger(value.unitPlatingPriceToman) ||
    !isNonNegativeSafeInteger(value.platingLeadTimeDays) ||
    !isNonNegativeSafeInteger(value.maxQuantity) ||
    value.maxQuantity < 1 ||
    value.maxQuantity > MAX_LINE_QUANTITY ||
    !isNonNegativeSafeInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > value.maxQuantity
  ) {
    return null;
  }

  return {
    key: cartItemKey(value.variantId, platingType),
    variantId: value.variantId,
    productSlug: value.productSlug,
    productName: value.productName,
    variantLabel: value.variantLabel,
    media,
    unitSalePriceToman: value.unitSalePriceToman,
    platingType,
    unitPlatingPriceToman: value.unitPlatingPriceToman,
    platingLeadTimeDays: value.platingLeadTimeDays,
    quantity: value.quantity,
    maxQuantity: value.maxQuantity,
  };
}

export function cartItemKey(variantId: string, platingType: CartPlatingType | null): string {
  return `${variantId}:${platingType ?? 'NONE'}`;
}

export function addCartItem(
  items: readonly CartItem[],
  input: AddCartItemInput,
): readonly CartItem[] {
  const maxQuantity = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.trunc(input.maxQuantity)));
  const addedQuantity = Math.max(1, Math.min(maxQuantity, Math.trunc(input.quantity)));
  const key = cartItemKey(input.variantId, input.platingType);
  const existing = items.find((item) => item.key === key);
  const quantity = Math.min(maxQuantity, (existing?.quantity ?? 0) + addedQuantity);
  const nextItem: CartItem = {
    ...input,
    key,
    quantity,
    maxQuantity,
  };

  if (!existing) {
    return [...items, nextItem];
  }

  return items.map((item) => (item.key === key ? nextItem : item));
}

export function setCartItemQuantity(
  items: readonly CartItem[],
  key: string,
  quantity: number,
): readonly CartItem[] {
  if (quantity <= 0) {
    return removeCartItem(items, key);
  }

  return items.map((item) =>
    item.key === key
      ? {
          ...item,
          quantity: Math.min(item.maxQuantity, Math.max(1, Math.trunc(quantity))),
        }
      : item,
  );
}

export function removeCartItem(items: readonly CartItem[], key: string): readonly CartItem[] {
  return items.filter((item) => item.key !== key);
}

export function getCartItemCount(items: readonly CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function getCartSubtotalToman(items: readonly CartItem[]): number {
  return items.reduce(
    (total, item) => total + (item.unitSalePriceToman + item.unitPlatingPriceToman) * item.quantity,
    0,
  );
}

export function serializeCart(items: readonly CartItem[]): string {
  return JSON.stringify(items);
}

export function deserializeCart(serialized: string | null): readonly CartItem[] {
  if (!serialized) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(serialized);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .slice(0, MAX_CART_LINES)
      .map(normalizeStoredCartItem)
      .filter((item): item is CartItem => item !== null)
      .reduce<readonly CartItem[]>((items, item) => addCartItem(items, item), []);
  } catch {
    return [];
  }
}
