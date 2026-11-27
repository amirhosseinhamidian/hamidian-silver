import {
  catalogFacetRanges,
  readCatalogFacetFilters,
  type CatalogFacetFilters,
  type PublicCatalogFacets,
} from './catalog-filter-state';
import { maxCatalogFacetPage } from './catalog-pagination';
import type { PublicCatalogProductSummary } from './public-catalog';

export const giftFinderPath = '/gift-finder';
export const giftAttributeCodes = {
  occasion: 'gift-occasion',
  recipient: 'intended-for',
  style: 'gift-style',
} as const;
const attributeFields = Object.keys(giftAttributeCodes) as (keyof typeof giftAttributeCodes)[];
const categoryFields = [...attributeFields, 'category'] as const;
export const maxGiftBudgetToman = catalogFacetRanges[0].ceiling;
const optionCode = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export type GiftFinderChoices = Partial<Record<(typeof categoryFields)[number], string>>;
export type GiftFinderRequest = GiftFinderChoices & { budget: number; page: number };
export type GiftFinderOptions = Record<
  (typeof categoryFields)[number],
  PublicCatalogFacets['categories']
>;
export type GiftFinderResults = {
  items: PublicCatalogProductSummary[];
  totalPages: number;
  suggestedBudget: number | null;
};

export function readGiftBudget(value: string) {
  const { filters, invalidRange } = readCatalogFacetFilters({ maxPriceToman: value });
  return invalidRange ? null : (filters.maxPriceToman ?? null);
}

export function parseGiftFinderRequest(input: unknown): GiftFinderRequest | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const { budget, page, ...values } = input as Record<string, unknown>;
  if (
    typeof budget !== 'number' ||
    !Number.isInteger(budget) ||
    budget < 1 ||
    budget > maxGiftBudgetToman ||
    typeof page !== 'number' ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > maxCatalogFacetPage
  )
    return null;
  const choices: GiftFinderChoices = {};
  for (const [key, value] of Object.entries(values)) {
    const field = categoryFields.find((entry) => entry === key);
    if (
      !field ||
      typeof value !== 'string' ||
      !value ||
      value.trim() !== value ||
      /[\p{Cc}]/u.test(value) ||
      (field === 'category' ? value.length > 180 : value.length > 64 || !optionCode.test(value))
    ) {
      return null;
    }
    choices[field] = value;
  }
  return { ...choices, budget, page };
}

export function giftFinderFilters(input: GiftFinderRequest): CatalogFacetFilters {
  return {
    page: input.page,
    pageSize: 12,
    sort: 'featured',
    availability: 'in-stock',
    checkoutStockOnly: true,
    minPriceToman: 1,
    maxPriceToman: input.budget,
    categories: input.category ? [input.category] : undefined,
    attributes: attributeFields.flatMap((key) => {
      const value = input[key];
      return value ? [{ code: giftAttributeCodes[key], values: [value] }] : [];
    }),
  };
}

export function giftFinderOptions(facets: PublicCatalogFacets): GiftFinderOptions {
  function options(code: string) {
    return (
      facets.attributes
        .find(
          (attribute) =>
            attribute.code === code &&
            (attribute.kind === 'SELECT' || attribute.kind === 'MULTI_SELECT'),
        )
        ?.options.filter(({ count }) => count > 0) ?? []
    );
  }
  return {
    occasion: options(giftAttributeCodes.occasion),
    recipient: options(giftAttributeCodes.recipient),
    style: options(giftAttributeCodes.style),
    category: facets.categories.filter(({ count }) => count > 0),
  };
}

export function withinGiftBudget(
  item: Pick<PublicCatalogProductSummary, 'isAvailable' | 'availableQuantity' | 'salePriceToman'>,
  budget: number,
): boolean {
  return (
    item.isAvailable &&
    item.availableQuantity > 0 &&
    item.salePriceToman !== null &&
    Number.isSafeInteger(item.salePriceToman) &&
    item.salePriceToman >= 1 &&
    item.salePriceToman <= budget
  );
}

export function giftCollectionSlug(value: unknown) {
  return typeof value === 'string' && value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    ? value
    : undefined;
}
