import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KnowledgeHub } from '@/components/guide/knowledge-hub';
import type { PublicGuideArticleSummary } from '@/lib/guide/public-guide';

const featured: PublicGuideArticleSummary = {
  id: 'article-1',
  title: 'راهنمای نگهداری نقره',
  slug: 'silver-care',
  eyebrow: null,
  excerpt: 'راهنمای کاربردی',
  format: 'CARE_GUIDE',
  heroMedia: null,
  cardMedia: null,
  seoCanonicalPath: null,
  seoNoIndex: false,
  seoOgMedia: null,
  readingTimeMinutes: 4,
  isFeatured: true,
  publishedAt: null,
  topics: [],
  updatedAt: '2026-10-14T10:00:00.000Z',
};

const filters = { page: 1, limit: 12 } as const;

describe('KnowledgeHub', () => {
  it('does not render an empty secondary list when the featured article is the only result', () => {
    render(
      <KnowledgeHub
        articles={{ items: [featured], total: 1, page: 1, limit: 12, totalPages: 1 }}
        topics={[]}
        filters={filters}
      />,
    );

    expect(screen.getByRole('heading', { name: featured.title })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'بیشتر بدانید' })).not.toBeInTheDocument();
    expect(screen.queryByText('هنوز پاسخی با این مشخصات پیدا نشد.')).not.toBeInTheDocument();
    expect(document.getElementById('guide-results')).toBeInTheDocument();
  });

  it('keeps the useful empty state when the complete result set is empty', () => {
    render(
      <KnowledgeHub
        articles={{ items: [], total: 0, page: 1, limit: 12, totalPages: 1 }}
        topics={[]}
        filters={filters}
      />,
    );

    expect(screen.getByText('هنوز پاسخی با این مشخصات پیدا نشد.')).toBeInTheDocument();
  });
});
