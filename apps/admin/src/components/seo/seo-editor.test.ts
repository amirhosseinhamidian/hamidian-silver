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
  it('accepts only internal canonical paths without query or fragment', () => {
    expect(isValidSeoCanonicalPath('/brands/hamidian')).toBe(true);
    expect(isValidSeoCanonicalPath('https://example.com/brands/hamidian')).toBe(false);
    expect(isValidSeoCanonicalPath('/brands/hamidian?ref=home')).toBe(false);
  });
});
