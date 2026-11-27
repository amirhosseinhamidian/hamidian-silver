import { describe, expect, it } from 'vitest';

import {
  giftFinderFilters,
  parseGiftFinderRequest,
  readGiftBudget,
  withinGiftBudget,
} from './gift-finder';

describe('gift finder requests', () => {
  it('accepts whole toman in local digits and rejects out-of-range values', () => {
    expect(readGiftBudget('۱٬۲۵۰٬۰۰۰')).toBe(1_250_000);
    expect(readGiftBudget('٧٥٠,٠٠٠')).toBe(750_000);
    expect(readGiftBudget('۱٫۵')).toBeNull();
    expect(readGiftBudget('۰')).toBeNull();
    expect(readGiftBudget('2147483648')).toBeNull();
  });

  it('uses the catalog registry codes, commercial sort and in-stock variant budget', () => {
    const input = parseGiftFinderRequest({
      budget: 750_000,
      page: 1,
      occasion: 'birthday',
      recipient: 'women',
      style: 'minimal',
      category: 'rings',
    });
    expect(input && giftFinderFilters(input)).toMatchObject({
      page: 1,
      sort: 'featured',
      availability: 'in-stock',
      checkoutStockOnly: true,
      minPriceToman: 1,
      maxPriceToman: 750_000,
      categories: ['rings'],
      attributes: [
        { code: 'gift-occasion', values: ['birthday'] },
        { code: 'intended-for', values: ['women'] },
        { code: 'gift-style', values: ['minimal'] },
      ],
    });
    expect(parseGiftFinderRequest({ budget: 750_000, page: 1, recipient: ['women'] })).toBeNull();
    expect(
      parseGiftFinderRequest({ budget: 750_000, page: 1, availability: 'out-of-stock' }),
    ).toBeNull();
  });

  it('checks the matching available price independently of the card default price', () => {
    const product = {
      isAvailable: true,
      availableQuantity: 1,
      salePriceToman: 600_000,
      defaultSalePriceToman: 900_000,
    };
    expect(withinGiftBudget(product, 600_000)).toBe(true);
    expect(withinGiftBudget({ ...product, availableQuantity: 0 }, 600_000)).toBe(false);
    expect(withinGiftBudget({ ...product, salePriceToman: null }, 600_000)).toBe(false);
    expect(withinGiftBudget(product, 599_999)).toBe(false);
  });
});
