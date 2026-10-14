import Link from 'next/link';

import { StorefrontImage } from '@/components/media/storefront-image';
import { guideFormatLabel, type PublicGuideArticleSummary } from '@/lib/guide/public-guide';

const number = new Intl.NumberFormat('fa-IR');

export function GuideArticleCard({
  article,
  prominent = false,
}: Readonly<{ article: PublicGuideArticleSummary; prominent?: boolean }>) {
  const cardMedia = article.cardMedia ?? article.heroMedia;
  return (
    <article
      className={
        prominent
          ? 'group grid overflow-hidden bg-[#171717] text-white lg:grid-cols-[1.15fr_0.85fr]'
          : 'group flex h-full flex-col border-t border-[var(--sf-color-border)] pt-5'
      }
    >
      <Link
        href={`/guide/${article.slug}`}
        className={
          prominent
            ? 'relative min-h-72 overflow-hidden bg-[#292929] lg:min-h-[30rem]'
            : 'relative aspect-[4/3] overflow-hidden bg-[var(--sf-color-surface)]'
        }
        aria-label={`مطالعه ${article.title}`}
      >
        {cardMedia?.url ? (
          <StorefrontImage
            src={cardMedia.url}
            alt={cardMedia.altText?.trim() || article.title}
            fill
            sizes={
              prominent ? '(min-width: 1024px) 58vw, 100vw' : '(min-width: 1024px) 33vw, 100vw'
            }
            className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"
          />
        ) : (
          <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_30%,#f5f2eb_0,transparent_32%),linear-gradient(145deg,#d4cec2,#8d877d)]" />
        )}
      </Link>

      <div
        className={
          prominent ? 'flex flex-col justify-center p-8 sm:p-12' : 'flex flex-1 flex-col py-6'
        }
      >
        <div
          className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${
            prominent ? 'text-white/55' : 'text-[var(--sf-color-subtle)]'
          }`}
        >
          <span>{guideFormatLabel(article.format)}</span>
          {article.readingTimeMinutes ? (
            <span>{number.format(article.readingTimeMinutes)} دقیقه مطالعه</span>
          ) : null}
        </div>
        <h2
          className={`${prominent ? 'mt-6 text-3xl sm:text-5xl' : 'mt-4 text-xl sm:text-2xl'} font-normal leading-[1.55]`}
        >
          <Link href={`/guide/${article.slug}`}>{article.title}</Link>
        </h2>
        {article.excerpt ? (
          <p
            className={`mt-5 line-clamp-3 text-base leading-8 ${
              prominent ? 'text-white/70' : 'text-[var(--sf-color-muted)]'
            }`}
          >
            {article.excerpt}
          </p>
        ) : null}
        {article.topics.length ? (
          <div
            className={`mt-6 flex flex-wrap gap-2 ${prominent ? 'text-white/60' : 'text-[var(--sf-color-muted)]'}`}
          >
            {article.topics.map((topic) => (
              <span key={topic.id} className="text-sm">
                #{topic.name}
              </span>
            ))}
          </div>
        ) : null}
        <Link
          href={`/guide/${article.slug}`}
          className={`mt-8 w-fit border-b pb-1 text-sm ${prominent ? 'border-white/55' : 'border-[var(--sf-color-ink)]'}`}
        >
          خواندن دانستنی
        </Link>
      </div>
    </article>
  );
}
