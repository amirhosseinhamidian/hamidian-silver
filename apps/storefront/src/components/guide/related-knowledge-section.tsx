import Link from 'next/link';

import { GuideArticleCard } from '@/components/guide/guide-article-card';
import type { PublicGuideArticleSummary } from '@/lib/guide/public-guide';

type RelatedKnowledgeSectionProps = Readonly<{
  articles: readonly PublicGuideArticleSummary[];
  eyebrow?: string;
  title?: string;
  headingId?: string;
  className?: string;
}>;

export function RelatedKnowledgeSection({
  articles,
  eyebrow = 'برای انتخاب آگاهانه‌تر',
  title = 'دانستنی‌های مرتبط',
  headingId = 'related-knowledge-title',
  className = '',
}: RelatedKnowledgeSectionProps) {
  if (!articles.length) return null;

  return (
    <section aria-labelledby={headingId} className={className}>
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--sf-color-border)] pb-6">
        <div>
          <p className="text-xs tracking-[0.16em] text-[var(--sf-color-subtle)]">{eyebrow}</p>
          <h2 id={headingId} className="mt-3 text-3xl font-normal sm:text-4xl">
            {title}
          </h2>
        </div>
        <Link
          href="/guide"
          className="border-b border-[var(--sf-color-ink)] pb-1 text-sm text-[var(--sf-color-muted)] transition-colors hover:text-[var(--sf-color-ink)]"
        >
          همه دانستنی‌ها
        </Link>
      </header>
      <div className="mt-9 grid gap-x-8 gap-y-12 md:grid-cols-3">
        {articles.slice(0, 3).map((article) => (
          <GuideArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
