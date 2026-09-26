import { describe, expect, it } from 'vitest';
import {
  createSeoEditorValue,
  isValidSeoCanonicalPath,
  seoEditorPayload,
} from '@/components/seo/seo-editor';

describe('SEO editor helpers', () => {
  it('normalizes optional metadata into the API payload', () => {
    expect(
      seoEditorPayload({
        ...createSeoEditorValue(),
        title: ' عنوان اختصاصی ',
        canonicalPath: '/products/silver-ring',
        noIndex: true,
      }),
    ).toEqual({
      seoTitle: 'عنوان اختصاصی',
      seoDescription: null,
      seoCanonicalPath: '/products/silver-ring',
      seoNoIndex: true,
      seoOgMediaId: null,
    });
  });
  it('accepts only safe public canonical paths and optional resource prefixes', () => {
    expect(isValidSeoCanonicalPath('/brands/hamidian', '/brands/')).toBe(true);
    expect(isValidSeoCanonicalPath('/products/ring', '/brands/')).toBe(false);
    expect(isValidSeoCanonicalPath('https://example.com/brands/hamidian')).toBe(false);
    expect(isValidSeoCanonicalPath('/brands/hamidian?ref=home')).toBe(false);
    expect(isValidSeoCanonicalPath('/brands\\evil.example')).toBe(false);
    expect(isValidSeoCanonicalPath('/brands/../products/ring')).toBe(false);
    expect(isValidSeoCanonicalPath('/brands/%2e%2e/products/ring')).toBe(false);
    expect(isValidSeoCanonicalPath('/account/orders')).toBe(false);
  });
});
