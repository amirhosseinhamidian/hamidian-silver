import { calculatePromotion, isPromotionTarget } from './promotion-engine';
import { selectCatalogPromotion } from './promotion-presentation';
import { createQuoteToken, matchesQuote, parseQuoteToken } from './promotion-quote';

const cap = {
  value: 1_000,
  minSubtotalToman: 0,
  maxDiscountToman: 2_000,
  maxDiscountBps: 2_000,
  bundleProductIds: [],
};
const line = { productId: 'ring', categoryIds: ['silver'], quantity: 1, unitSalePriceToman: 5_005 };

describe('campaign pricing for the catalog', () => {
  const candidate = {
    ...cap,
    kind: 'PERCENT' as const,
    couponCode: null,
    remainingToman: 5_000,
    campaign: {
      name: 'Ring sale',
      audience: 'ALL_CUSTOMERS' as const,
      allProducts: false,
      productIds: ['ring'],
      categoryIds: [],
      endsAt: new Date('2026-11-30T00:00:00Z'),
    },
  };

  it('prices the default and each variant from their own current prices', () => {
    const offer = (price: number) => selectCatalogPromotion([candidate], line, price)?.price;
    expect(offer(5_005)).toMatchObject({
      regularToman: 5_005,
      discountToman: 500,
      finalToman: 4_505,
    });
    expect(offer(8_000)).toMatchObject({
      regularToman: 8_000,
      discountToman: 800,
      finalToman: 7_200,
    });
    expect(offer(10_000)).toMatchObject({
      regularToman: 10_000,
      discountToman: 1_000,
      finalToman: 9_000,
    });
    expect(offer(6_000)).toMatchObject({
      regularToman: 6_000,
      discountToman: 600,
      finalToman: 5_400,
    });
  });

  it('shows conditions without a price for cart, coupon and customer rules', () => {
    const variants = [
      { ...candidate, minSubtotalToman: 1 },
      { ...candidate, kind: 'FIXED' as const },
      { ...candidate, kind: 'BUNDLE' as const, bundleProductIds: ['ring', 'chain'] },
      { ...candidate, kind: 'FREE_SHIPPING' as const },
      { ...candidate, couponCode: 'PRIVATE' },
      { ...candidate, campaign: { ...candidate.campaign, audience: 'FIRST_PURCHASE' as const } },
    ];
    for (const rule of variants)
      expect(selectCatalogPromotion([rule], line, 5_005)).toMatchObject({ price: null });
    expect(
      selectCatalogPromotion([{ ...candidate, couponCode: 'PRIVATE' }], line, 5_005),
    ).not.toHaveProperty('couponCode');
    expect(selectCatalogPromotion([candidate], line, null)).toBeNull();
    expect(selectCatalogPromotion([candidate], { ...line, productId: 'chain' }, 5_005)).toBeNull();
  });

  it('respects priority when a cart rule would win for a single unit', () => {
    const fixed = { ...candidate, kind: 'FIXED' as const };
    expect(selectCatalogPromotion([fixed, candidate], line, 5_005)).toMatchObject({
      conditions: ['ORDER_AMOUNT'],
      price: null,
    });
    expect(
      selectCatalogPromotion([{ ...fixed, minSubtotalToman: 10_000 }, candidate], line, 5_005)
        ?.price,
    ).toMatchObject({ discountToman: 500 });
  });
});

describe('promotion amounts', () => {
  it('uses integer rounding and every economic cap', () => {
    const rule = { ...cap, kind: 'PERCENT' as const, value: 1_500 };
    expect(calculatePromotion(rule, [line], 0, 900)?.merchandiseDiscountToman).toBe(750);
    expect(calculatePromotion(rule, [line], 0, 250)?.merchandiseDiscountToman).toBe(250);
    expect(
      calculatePromotion({ ...rule, maxDiscountToman: 100 }, [line], 0, 900)
        ?.merchandiseDiscountToman,
    ).toBe(100);
    expect(
      calculatePromotion({ ...rule, maxDiscountBps: 500 }, [line], 0, 900)
        ?.merchandiseDiscountToman,
    ).toBe(250);
  });

  it('checks the scope and purchase threshold inclusively', () => {
    const campaign = { allProducts: false, productIds: [], categoryIds: ['silver'] };
    expect(isPromotionTarget(campaign, line)).toBe(true);
    expect(isPromotionTarget(campaign, { ...line, categoryIds: ['steel'] })).toBe(false);
    const rule = { ...cap, kind: 'THRESHOLD' as const, minSubtotalToman: 5_005 };
    expect(calculatePromotion(rule, [line], 0, 1_000)?.merchandiseDiscountToman).toBe(1_000);
    expect(calculatePromotion(rule, [{ ...line, unitSalePriceToman: 5_004 }], 0, 1_000)).toBeNull();
  });

  it('discounts complete repeatable bundles and caps against bundled units', () => {
    const ring = { ...line, quantity: 3, unitSalePriceToman: 100 };
    const chain = { ...line, productId: 'chain', quantity: 2, unitSalePriceToman: 150 };
    const rule = {
      ...cap,
      kind: 'BUNDLE' as const,
      value: 100,
      bundleProductIds: ['ring', 'chain'],
    };
    expect(calculatePromotion(rule, [ring], 0, 1_000)).toBeNull();
    expect(
      calculatePromotion(rule, [ring, chain, { ...line, productId: 'other' }], 0, 1_000)
        ?.merchandiseDiscountToman,
    ).toBe(100);
  });

  it('applies free shipping only if the complete shipping charge fits the caps', () => {
    const rule = { ...cap, kind: 'FREE_SHIPPING' as const, value: 0 };
    expect(calculatePromotion(rule, [line], 400, 400)).toEqual({
      merchandiseDiscountToman: 0,
      shippingDiscountToman: 400,
    });
    expect(calculatePromotion(rule, [line], 401, 400)).toBeNull();
    expect(calculatePromotion(rule, [line], 0, 400)).toBeNull();
  });
});

it('binds the quote to the accepted price and rejects it at expiration', () => {
  const issuedAt = new Date('2026-11-21T12:00:00Z');
  const binding = { userId: 'buyer', amountToman: 20_000 };
  const { expiresAt, quoteToken } = createQuoteToken('test-quote-secret', null, binding, issuedAt);
  const parsed = parseQuoteToken(quoteToken);
  if (!parsed) throw new Error('Expected a well-formed quote.');
  expect(matchesQuote('test-quote-secret', parsed, binding, issuedAt)).toBe(true);
  expect(
    matchesQuote('test-quote-secret', parsed, { ...binding, userId: 'another buyer' }, issuedAt),
  ).toBe(false);
  expect(
    matchesQuote('test-quote-secret', parsed, { ...binding, amountToman: 20_001 }, issuedAt),
  ).toBe(false);
  expect(matchesQuote('test-quote-secret', parsed, binding, new Date(expiresAt))).toBe(false);
});
