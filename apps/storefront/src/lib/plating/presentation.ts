export const STOREFRONT_PLATING_TYPES = ['GOLD', 'ROSE_GOLD', 'RHODIUM'] as const;

export type StorefrontPlatingType = (typeof STOREFRONT_PLATING_TYPES)[number];

type PlatingPresentation = Readonly<{
  label: string;
  color: string;
  borderColor: string;
}>;

const PLATING_PRESENTATION: Record<StorefrontPlatingType, PlatingPresentation> = {
  GOLD: {
    label: 'آبکاری طلا',
    color: '#C9A227',
    borderColor: '#A98212',
  },
  ROSE_GOLD: {
    label: 'آبکاری رزگلد',
    color: '#B76E79',
    borderColor: '#96545F',
  },
  RHODIUM: {
    label: 'آبکاری رودیوم',
    color: '#C7CDD3',
    borderColor: '#8F99A3',
  },
};

export function isStorefrontPlatingType(value: unknown): value is StorefrontPlatingType {
  return STOREFRONT_PLATING_TYPES.some((type) => type === value);
}

export function platingPresentation(type: string): PlatingPresentation {
  if (isStorefrontPlatingType(type)) return PLATING_PRESENTATION[type];
  return { label: type, color: '#D1D5DB', borderColor: '#9CA3AF' };
}
