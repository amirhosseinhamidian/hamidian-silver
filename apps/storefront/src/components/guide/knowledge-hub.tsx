import Link from 'next/link';

import { GuideArticleCard } from '@/components/guide/guide-article-card';
import { ButtonLink } from '@/components/ui/button';
import {
  buildGuideHref,
  type GuideFilters,
  type PublicGuideArticleList,
  type PublicGuideTopic,
} from '@/lib/guide/public-guide';

const number = new Intl.NumberFormat('fa-IR');

export function KnowledgeHub({
  articles,
  topics,
  filters,
}: Readonly<{
  articles: PublicGuideArticleList;
  topics: readonly PublicGuideTopic[];
  filters: GuideFilters;
}>) {
  const isDiscoveryView = !filters.q && !filters.topic && !filters.format && filters.page === 1;
  const featured = isDiscoveryView
    ? articles.items.find((article) => article.isFeatured)
    : undefined;
  const remaining = featured
    ? articles.items.filter((article) => article.id !== featured.id)
    : articles.items;

  return (
    <main id="main-content">
      <header className="relative isolate overflow-hidden bg-[#171717] py-20 text-white sm:py-28 lg:py-36">
        <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-32 top-[-16rem] size-[34rem] rounded-full border border-white/10" />
          <div className="absolute -right-12 top-[-10rem] size-[22rem] rounded-full border border-white/10" />
          <div className="absolute -bottom-44 left-[-5rem] size-[28rem] rounded-full bg-[radial-gradient(circle_at_40%_35%,#c9b47b_0,#655b43_36%,#171717_72%)] opacity-35" />
        </div>
        <div className="sf-container grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)] lg:items-end">
          <div>
            <p className="text-xs tracking-[0.2em] text-white/50">برای انتخاب آگاهانه‌تر</p>
            <h1 className="mt-7 max-w-4xl text-[clamp(3rem,8vw,7rem)] font-normal leading-[1.1]">
              دانستنی‌ها
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-9 text-white/70 sm:text-xl sm:leading-10">
              پاسخ پرسش‌ها، راهنمای انتخاب و نکته‌های کاربردی درباره نقره، ساعت و محصولاتی که به
              مجموعه اضافه می‌شوند.
            </p>
          </div>
          <form action="/guide" role="search" className="border-t border-white/25 pt-7">
            <label htmlFor="guide-search" className="text-xs text-white/55">
              چه چیزی می‌خواهید بدانید؟
            </label>
            <div className="mt-4 flex border-b border-white/55">
              <input
                id="guide-search"
                name="q"
                defaultValue={filters.q}
                placeholder="مثلاً تشخیص نقره اصل"
                className="min-h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
              <button type="submit" className="px-3 text-sm text-white">
                جست‌وجو
              </button>
            </div>
          </form>
        </div>
      </header>

      <nav aria-label="موضوعات دانستنی‌ها" className="border-b border-[var(--sf-color-border)]">
        <div className="sf-container flex gap-3 overflow-x-auto py-5 whitespace-nowrap">
          <Link
            href="/guide"
            aria-current={!filters.topic ? 'page' : undefined}
            className={`rounded-full border px-5 py-2 text-sm ${
              !filters.topic
                ? 'border-[var(--sf-color-ink)] bg-[var(--sf-color-ink)] text-white'
                : 'border-[var(--sf-color-border)]'
            }`}
          >
            همه دانستنی‌ها
          </Link>
          {topics.map((topic) => (
            <Link
              key={topic.id}
              href={buildGuideHref({ ...filters, q: undefined, topic: topic.slug, page: 1 }, 1)}
              aria-current={filters.topic === topic.slug ? 'page' : undefined}
              className={`rounded-full border px-5 py-2 text-sm ${
                filters.topic === topic.slug
                  ? 'border-[var(--sf-color-ink)] bg-[var(--sf-color-ink)] text-white'
                  : 'border-[var(--sf-color-border)]'
              }`}
            >
              {topic.name}
            </Link>
          ))}
        </div>
      </nav>

      <div className="sf-container py-14 sm:py-20">
        {featured ? (
          <section aria-labelledby="featured-knowledge-title">
            <p
              id="featured-knowledge-title"
              className="mb-6 text-xs tracking-[0.16em] text-[var(--sf-color-subtle)]"
            >
              پیشنهاد برای شروع
            </p>
            <GuideArticleCard article={featured} prominent />
          </section>
        ) : null}

        <section
          aria-labelledby="knowledge-list-title"
          className={featured ? 'mt-20 sm:mt-28' : undefined}
        >
          <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--sf-color-border)] pb-7">
            <div>
              <p className="text-xs tracking-[0.16em] text-[var(--sf-color-subtle)]">
                پاسخ‌ها و راهنماها
              </p>
              <h2 id="knowledge-list-title" className="mt-3 text-3xl font-normal sm:text-5xl">
                {filters.q
                  ? `نتیجه برای «${filters.q}»`
                  : filters.topic
                    ? 'دانستنی‌های این موضوع'
                    : 'بیشتر بدانید'}
              </h2>
            </div>
            <p className="text-sm text-[var(--sf-color-muted)]">
              {number.format(articles.total)} مطلب
            </p>
          </header>

          {remaining.length ? (
            <div className="mt-10 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {remaining.map((article) => (
                <GuideArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="py-24 text-center">
              <h3 className="text-2xl font-normal">هنوز پاسخی با این مشخصات پیدا نشد.</h3>
              <p className="mt-4 text-sm leading-8 text-[var(--sf-color-muted)]">
                عبارت کوتاه‌تری جست‌وجو کنید یا همه موضوعات را ببینید.
              </p>
              <ButtonLink href="/guide" className="mt-7">
                همه دانستنی‌ها
              </ButtonLink>
            </div>
          )}

          {articles.totalPages > 1 ? (
            <nav
              aria-label="صفحه‌بندی دانستنی‌ها"
              className="mt-16 flex items-center justify-center gap-3"
            >
              {articles.page > 1 ? (
                <ButtonLink href={buildGuideHref(filters, articles.page - 1)}>صفحه قبل</ButtonLink>
              ) : null}
              <span className="px-4 text-sm text-[var(--sf-color-muted)]">
                صفحه {number.format(articles.page)} از {number.format(articles.totalPages)}
              </span>
              {articles.page < articles.totalPages ? (
                <ButtonLink href={buildGuideHref(filters, articles.page + 1)}>صفحه بعد</ButtonLink>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
