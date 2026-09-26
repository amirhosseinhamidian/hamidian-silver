import {
  BRAND_SEO_CANONICAL_PATH_PATTERN,
  CATEGORY_SEO_CANONICAL_PATH_PATTERN,
  PRODUCT_SEO_CANONICAL_PATH_PATTERN,
  SEO_CANONICAL_PATH_PATTERN,
  SEO_TITLE_TEMPLATE_PATTERN,
} from './seo-validation';

describe('SEO validation patterns', () => {
  it('accepts only safe public internal canonical paths', () => {
    expect(SEO_CANONICAL_PATH_PATTERN.test('/about/story')).toBe(true);
    expect(SEO_CANONICAL_PATH_PATTERN.test('//evil.example/path')).toBe(false);
    expect(SEO_CANONICAL_PATH_PATTERN.test('/brands\\evil.example')).toBe(false);
    expect(SEO_CANONICAL_PATH_PATTERN.test('/products/../account')).toBe(false);
    expect(SEO_CANONICAL_PATH_PATTERN.test('/products/%2e%2e/account')).toBe(false);
    expect(SEO_CANONICAL_PATH_PATTERN.test('/account/orders')).toBe(false);
  });

  it('keeps entity canonical paths inside their resource family', () => {
    expect(PRODUCT_SEO_CANONICAL_PATH_PATTERN.test('/products/silver-ring')).toBe(true);
    expect(PRODUCT_SEO_CANONICAL_PATH_PATTERN.test('/brands/silver-ring')).toBe(false);

    expect(CATEGORY_SEO_CANONICAL_PATH_PATTERN.test('/categories/rings')).toBe(true);
    expect(CATEGORY_SEO_CANONICAL_PATH_PATTERN.test('/products/rings')).toBe(false);

    expect(BRAND_SEO_CANONICAL_PATH_PATTERN.test('/brands/cartier')).toBe(true);
    expect(BRAND_SEO_CANONICAL_PATH_PATTERN.test('/categories/cartier')).toBe(false);
  });

  it('requires exactly one title placeholder token', () => {
    expect(SEO_TITLE_TEMPLATE_PATTERN.test('%s | گالری حمیدیان')).toBe(true);
    expect(SEO_TITLE_TEMPLATE_PATTERN.test('گالری حمیدیان')).toBe(false);
    expect(SEO_TITLE_TEMPLATE_PATTERN.test('%s | %s | گالری حمیدیان')).toBe(false);
  });
});
