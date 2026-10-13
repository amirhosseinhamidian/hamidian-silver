import { describe, expect, it } from 'vitest';
import {
  guideBlockLabel,
  guideFormatLabel,
  parseGuideArticle,
  parseGuideArticleList,
  parseGuideTopics,
} from './guide-model';

const topic = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'نگهداری نقره',
  slug: 'silver-care',
  description: null,
  coverMedia: null,
  seoTitle: null,
  seoDescription: null,
  seoCanonicalPath: null,
  seoNoIndex: false,
  sortOrder: 0,
  isActive: true,
};

const article = {
  id: '20000000-0000-4000-8000-000000000001',
  title: 'چگونه نقره را تمیز کنیم؟',
  slug: 'clean-silver',
  eyebrow: 'نگهداری و مراقبت',
  excerpt: 'روش‌های ایمن برای تمیزکردن نقره',
  format: 'CARE_GUIDE',
  status: 'PUBLISHED',
  heroMedia: null,
  heroMobileMedia: null,
  seoTitle: null,
  seoDescription: null,
  seoCanonicalPath: '/guide/clean-silver',
  seoNoIndex: false,
  seoOgMedia: null,
  searchKeywords: ['تمیز کردن نقره'],
  readingTimeMinutes: 5,
  isFeatured: true,
  publishedAt: '2026-10-12T12:00:00.000Z',
  topics: [topic],
  blocks: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      type: 'STEPS',
      variant: 'numbered',
      anchorId: 'safe-cleaning',
      primaryMedia: null,
      content: { heading: 'مراحل', items: [{ title: 'آماده‌سازی', body: 'پارچه نرم بردارید.' }] },
      sortOrder: 0,
    },
  ],
  productIds: [],
  categoryIds: [],
  brandIds: [],
  version: 2,
  createdAt: '2026-10-12T11:00:00.000Z',
  updatedAt: '2026-10-12T12:00:00.000Z',
};

describe('guide model', () => {
  it('parses structured guide articles and blocks', () => {
    const parsed = parseGuideArticle(article);
    expect(parsed?.title).toBe(article.title);
    expect(parsed?.blocks[0]?.type).toBe('STEPS');
    expect(parsed?.topics[0]?.slug).toBe('silver-care');
  });

  it('rejects unsupported block types and statuses', () => {
    expect(parseGuideArticle({ ...article, status: 'ACTIVE' })).toBeNull();
    expect(
      parseGuideArticle({ ...article, blocks: [{ ...article.blocks[0], type: 'HTML' }] }),
    ).toBeNull();
  });

  it('parses list and topic payloads defensively', () => {
    expect(parseGuideTopics([topic])).toHaveLength(1);
    expect(
      parseGuideArticleList({ items: [article], total: 1, page: 1, limit: 20, totalPages: 1 })
        ?.total,
    ).toBe(1);
    expect(parseGuideArticleList({ items: 'invalid' })).toBeNull();
  });

  it('provides Persian editorial labels', () => {
    expect(guideFormatLabel('BUYING_GUIDE')).toBe('راهنمای خرید');
    expect(guideBlockLabel('FAQ')).toBe('پرسش و پاسخ');
  });
});
