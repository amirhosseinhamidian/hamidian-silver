import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuideArticleCard } from '@/components/guide/guide-article-card';
import type { PublicGuideArticleSummary } from '@/lib/guide/public-guide';

const media = (id: string, url: string) => ({
  id,
  url,
  mimeType: 'image/webp',
  altText: id,
});
const article: PublicGuideArticleSummary = {
  id: 'article-1',
  title: 'راهنمای نقره',
  slug: 'silver-guide',
  eyebrow: null,
  excerpt: null,
  format: 'GUIDE',
  heroMedia: media('hero', 'https://media.test/hero.webp'),
  cardMedia: media('card', 'https://media.test/card.webp'),
  seoCanonicalPath: null,
  seoNoIndex: false,
  seoOgMedia: null,
  readingTimeMinutes: null,
  isFeatured: false,
  publishedAt: null,
  topics: [],
  updatedAt: '2026-10-13T10:00:00.000Z',
};

describe('GuideArticleCard', () => {
  it('prefers the independent card image', () => {
    render(<GuideArticleCard article={article} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://media.test/card.webp');
  });

  it('falls back to the hero image and then to the visual placeholder', () => {
    const { rerender } = render(<GuideArticleCard article={{ ...article, cardMedia: null }} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://media.test/hero.webp');

    rerender(<GuideArticleCard article={{ ...article, cardMedia: null, heroMedia: null }} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: `مطالعه ${article.title}` })).toBeInTheDocument();
  });
});
