import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KnowledgeArticle } from '@/components/guide/knowledge-article';
import type { PublicGuideArticle } from '@/lib/guide/public-guide';

const article: PublicGuideArticle = {
  id: 'article-1',
  title: 'راهنمای نقره ۹۲۵',
  slug: 'silver-925',
  eyebrow: 'شناخت نقره',
  excerpt: 'پاسخ روشن به پرسش‌های رایج درباره نقره',
  format: 'GUIDE',
  heroMedia: null,
  heroMobileMedia: null,
  cardMedia: null,
  productRecommendationMode: 'AUTOMATIC',
  seoTitle: null,
  seoDescription: null,
  seoCanonicalPath: null,
  seoNoIndex: false,
  seoOgMedia: null,
  searchKeywords: [],
  readingTimeMinutes: 5,
  isFeatured: false,
  publishedAt: '2026-10-14T10:00:00.000Z',
  topics: [],
  updatedAt: '2026-10-14T10:00:00.000Z',
  createdAt: '2026-10-14T09:00:00.000Z',
  blocks: [
    {
      id: 'block-1',
      type: 'RICH_TEXT',
      variant: 'standard',
      anchorId: 'silver-basics',
      primaryMedia: null,
      content: { heading: 'نقره ۹۲۵ چیست؟', markdown: 'متن دانستنی' },
      sortOrder: 0,
    },
  ],
  relatedProducts: [
    {
      id: 'product-1',
      name: 'انگشتر نقره',
      slug: 'silver-ring',
      shortDescription: null,
      salePriceToman: 1_000_000,
      primaryMedia: null,
    },
  ],
  relatedCategories: [],
  relatedBrands: [],
  relatedArticles: [],
};

describe('KnowledgeArticle', () => {
  it('renders the full-width hero before the desktop article grid', () => {
    const { container } = render(<KnowledgeArticle article={article} />);
    const main = container.querySelector('main');
    const hero = screen.getByRole('banner');
    const shell = container.querySelector('.sf-guide-article-shell');

    expect(hero.parentElement).toBe(main);
    expect(hero.nextElementSibling).toBe(shell);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-[clamp(2.2rem,4vw,4rem)]');
    expect(shell?.querySelector('aside')).toContainElement(
      screen.getAllByRole('navigation', { name: 'در این دانستنی' })[1] ?? null,
    );
  });

  it('shows resolved automatic products without requiring a product block', () => {
    render(<KnowledgeArticle article={article} />);

    expect(
      screen.getByRole('heading', { name: 'محصولات پیشنهادی برای این دانستنی' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'انگشتر نقره' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'انگشتر نقره' })[0]).toHaveAttribute(
      'href',
      '/products/silver-ring',
    );
  });

  it('does not duplicate the recommendation section when a product block controls its position', () => {
    render(
      <KnowledgeArticle
        article={{
          ...article,
          blocks: [
            ...article.blocks,
            {
              id: 'block-products',
              type: 'PRODUCT_CARDS',
              variant: 'grid',
              anchorId: null,
              primaryMedia: null,
              content: { heading: 'انتخاب‌های مقاله' },
              sortOrder: 1,
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'انتخاب‌های مقاله' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'محصولات پیشنهادی برای این دانستنی' }),
    ).not.toBeInTheDocument();
  });

  it('never renders recommendations when the article disables them', () => {
    render(<KnowledgeArticle article={{ ...article, productRecommendationMode: 'DISABLED' }} />);

    expect(screen.queryByText('انگشتر نقره')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'محصولات پیشنهادی برای این دانستنی' }),
    ).not.toBeInTheDocument();
  });
});
