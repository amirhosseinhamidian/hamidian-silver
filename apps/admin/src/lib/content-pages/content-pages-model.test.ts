import { describe, expect, it } from 'vitest';

import {
  CONTENT_PAGE_KEYS,
  parseAdminContentPage,
  parseAdminContentPages,
} from '@/lib/content-pages/content-pages-model';

function page(key: string) {
  return {
    key,
    title: `Page ${key}`,
    eyebrow: null,
    subtitle: null,
    body: null,
    heroMediaId: null,
    heroMedia: null,
    sections: [],
    seoTitle: null,
    seoDescription: null,
    seoCanonicalPath: null,
    seoNoIndex: false,
    seoOgMediaId: null,
    seoOgMedia: null,
    updatedByUserId: null,
    updatedAt: null,
  };
}

describe('content pages model', () => {
  it('parses the complete admin page collection', () => {
    const parsed = parseAdminContentPages(CONTENT_PAGE_KEYS.map(page));

    expect(parsed).toHaveLength(7);
    expect(parsed?.map((item) => item.key)).toEqual(CONTENT_PAGE_KEYS);
  });

  it('accepts nullable public media URLs', () => {
    expect(
      parseAdminContentPage({
        ...page('ABOUT'),
        heroMediaId: '10000000-0000-4000-8000-000000000001',
        heroMedia: { url: null, altText: 'About', width: null, height: null },
      })?.heroMedia?.url,
    ).toBeNull();
  });

  it('rejects incomplete page collections', () => {
    expect(parseAdminContentPages([page('ABOUT')])).toBeNull();
    expect(parseAdminContentPage(page('UNKNOWN'))).toBeNull();
  });
});
