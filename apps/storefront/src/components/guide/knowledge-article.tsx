import Link from 'next/link';

import { RelatedKnowledgeSection } from '@/components/guide/related-knowledge-section';
import { GuideMarkdown } from '@/components/guide/guide-markdown';
import { StorefrontImage } from '@/components/media/storefront-image';
import { ResponsiveHeroImage } from '@/components/media/responsive-hero-image';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import {
  guideFormatLabel,
  type PublicGuideArticle,
  type PublicGuideBlock,
  type PublicGuideRelatedProduct,
} from '@/lib/guide/public-guide';

const number = new Intl.NumberFormat('fa-IR');
const date = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });

function contentText(content: Readonly<Record<string, unknown>>, key: string): string {
  return typeof content[key] === 'string' ? content[key].trim() : '';
}

function contentItems(content: Readonly<Record<string, unknown>>): Record<string, unknown>[] {
  return Array.isArray(content.items)
    ? content.items.filter(
        (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
      )
    : [];
}

function safeAnchor(value: string | null): string | undefined {
  return value && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value) ? value : undefined;
}

function safeInternalHref(value: string): string | null {
  return /^\/(?!\/)(?!.*[\\\s])[^?#]*(?:\?[^#\s]*)?(?:#[^\s]*)?$/.test(value) ||
    /^#[a-z0-9][a-z0-9-]{0,79}$/.test(value)
    ? value
    : null;
}

function GuideImage({
  block,
  className = '',
}: Readonly<{ block: PublicGuideBlock; className?: string }>) {
  const heading = contentText(block.content, 'heading');
  if (!block.primaryMedia?.url) return null;
  return (
    <figure className={className}>
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--sf-color-surface)]">
        <StorefrontImage
          src={block.primaryMedia.url}
          alt={block.primaryMedia.altText?.trim() || heading || 'تصویر دانستنی'}
          fill
          sizes="(min-width: 1024px) 72vw, 100vw"
          className="object-cover"
        />
      </div>
      {contentText(block.content, 'caption') ? (
        <figcaption className="mt-3 text-xs leading-6 text-[var(--sf-color-subtle)]">
          {contentText(block.content, 'caption')}
        </figcaption>
      ) : null}
    </figure>
  );
}

function TextBlock({ block }: Readonly<{ block: PublicGuideBlock }>) {
  const heading = contentText(block.content, 'heading');
  const markdown = contentText(block.content, 'markdown');
  const paragraphs = Array.isArray(block.content.paragraphs)
    ? block.content.paragraphs.filter(
        (item): item is string => typeof item === 'string' && Boolean(item.trim()),
      )
    : contentText(block.content, 'body')
      ? [contentText(block.content, 'body')]
      : [];
  const highlighted = block.variant === 'highlight';
  return (
    <section
      id={safeAnchor(block.anchorId)}
      className={`scroll-mt-28 ${block.variant === 'narrow' ? 'mx-auto max-w-3xl' : ''} ${
        highlighted ? 'bg-[#f0ece3] px-6 py-9 sm:px-10 sm:py-12' : ''
      }`}
    >
      {heading ? (
        <h2 className="text-3xl font-normal leading-[1.5] sm:text-4xl">{heading}</h2>
      ) : null}
      <div
        className={`${heading ? 'mt-6' : ''} space-y-5 text-base leading-9 text-[var(--sf-color-muted)] sm:text-lg sm:leading-10`}
      >
        {markdown ? (
          <GuideMarkdown markdown={markdown} />
        ) : (
          paragraphs.map((paragraph, index) => <p key={`${paragraph}-${index}`}>{paragraph}</p>)
        )}
      </div>
    </section>
  );
}

function LeadBlock({ block }: Readonly<{ block: PublicGuideBlock }>) {
  const heading = contentText(block.content, 'heading');
  const body = contentText(block.content, 'body');
  const markdown = contentText(block.content, 'markdown');
  return (
    <section
      id={safeAnchor(block.anchorId)}
      className={`scroll-mt-28 grid gap-8 border-y border-[var(--sf-color-border)] py-10 sm:grid-cols-[8rem_minmax(0,1fr)] sm:py-14 ${
        block.variant === 'soft' ? 'bg-[var(--sf-color-surface)] px-6 sm:px-10' : ''
      }`}
    >
      <p className="text-xs tracking-[0.16em] text-[var(--sf-color-subtle)]">چکیده</p>
      <div className="max-w-4xl">
        {heading ? <h2 className="text-2xl font-normal sm:text-4xl">{heading}</h2> : null}
        {markdown ? (
          <div className="mt-5">
            <GuideMarkdown markdown={markdown} />
          </div>
        ) : body ? (
          <p className="mt-5 text-lg leading-10 text-[var(--sf-color-muted)] sm:text-2xl sm:leading-[2]">
            {body}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ImageTextBlock({ block }: Readonly<{ block: PublicGuideBlock }>) {
  const heading = contentText(block.content, 'heading');
  const body = contentText(block.content, 'body');
  const markdown = contentText(block.content, 'markdown');
  const imageLeft = block.variant === 'image-left';
  return (
    <section
      id={safeAnchor(block.anchorId)}
      className={`scroll-mt-28 grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14 ${
        block.variant === 'stacked' ? 'lg:grid-cols-1' : ''
      }`}
    >
      <GuideImage block={block} className={imageLeft ? 'lg:order-2' : ''} />
      <div className={imageLeft ? 'lg:order-1' : ''}>
        {heading ? (
          <h2 className="text-3xl font-normal leading-[1.5] sm:text-4xl">{heading}</h2>
        ) : null}
        {markdown ? (
          <div className="mt-6">
            <GuideMarkdown markdown={markdown} />
          </div>
        ) : body ? (
          <p className="mt-6 text-base leading-9 text-[var(--sf-color-muted)] sm:text-lg sm:leading-10">
            {body}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function StepsBlock({ block }: Readonly<{ block: PublicGuideBlock }>) {
  const items = contentItems(block.content);
  return (
    <section id={safeAnchor(block.anchorId)} className="scroll-mt-28">
      {contentText(block.content, 'heading') ? (
        <h2 className="text-3xl font-normal sm:text-4xl">
          {contentText(block.content, 'heading')}
        </h2>
      ) : null}
      <ol
        className={`mt-8 ${block.variant === 'cards' ? 'grid gap-px bg-[var(--sf-color-border)] md:grid-cols-2' : 'border-t border-[var(--sf-color-border)]'}`}
      >
        {items.map((item, index) => (
          <li
            key={index}
            className={`${block.variant === 'cards' ? 'bg-[var(--sf-color-canvas)] p-7 sm:p-9' : 'grid gap-5 border-b border-[var(--sf-color-border)] py-7 sm:grid-cols-[5rem_minmax(0,1fr)]'}`}
          >
            <span className="text-sm text-[var(--sf-color-subtle)]">
              {number.format(index + 1).padStart(2, '۰')}
            </span>
            <div>
              <h3 className="text-xl font-normal">{contentText(item, 'title')}</h3>
              {contentText(item, 'body') ? (
                <p className="mt-3 text-sm leading-8 text-[var(--sf-color-muted)]">
                  {contentText(item, 'body')}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function QuoteBlock({ block }: Readonly<{ block: PublicGuideBlock }>) {
  return (
    <figure
      id={safeAnchor(block.anchorId)}
      className={`scroll-mt-28 border-r-2 px-7 py-3 sm:px-12 ${block.variant === 'accent' ? 'border-[#a98d46] bg-[#f0ece3] py-10' : 'border-[var(--sf-color-ink)]'}`}
    >
      <blockquote className="text-2xl leading-[1.8] sm:text-4xl sm:leading-[1.7]">
        {contentText(block.content, 'quote')}
      </blockquote>
      {contentText(block.content, 'body') ? (
        <p className="mt-5 text-sm leading-8 text-[var(--sf-color-muted)]">
          {contentText(block.content, 'body')}
        </p>
      ) : null}
      {contentText(block.content, 'attribution') ? (
        <figcaption className="mt-6 text-xs text-[var(--sf-color-subtle)]">
          — {contentText(block.content, 'attribution')}
        </figcaption>
      ) : null}
    </figure>
  );
}

function TableBlock({ block }: Readonly<{ block: PublicGuideBlock }>) {
  const columns = Array.isArray(block.content.columns)
    ? block.content.columns.filter((cell): cell is string => typeof cell === 'string')
    : [];
  const rows = Array.isArray(block.content.rows)
    ? block.content.rows.filter((row): row is unknown[] => Array.isArray(row))
    : [];
  return (
    <section id={safeAnchor(block.anchorId)} className="scroll-mt-28">
      {contentText(block.content, 'heading') ? (
        <h2 className="text-3xl font-normal sm:text-4xl">
          {contentText(block.content, 'heading')}
        </h2>
      ) : null}
      <div className="mt-7 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-[var(--sf-color-ink)]">
              {columns.map((cell, index) => (
                <th key={index} scope="col" className="px-4 py-4 font-medium">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-[var(--sf-color-border)]">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-5 text-[var(--sf-color-muted)]">
                    {typeof cell === 'string' ? cell : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FaqBlock({ block }: Readonly<{ block: PublicGuideBlock }>) {
  const items = contentItems(block.content);
  return (
    <section id={safeAnchor(block.anchorId)} className="scroll-mt-28">
      {contentText(block.content, 'heading') ? (
        <h2 className="text-3xl font-normal sm:text-4xl">
          {contentText(block.content, 'heading')}
        </h2>
      ) : null}
      <div
        className={`mt-8 ${block.variant === 'cards' ? 'grid gap-4 md:grid-cols-2' : 'border-t border-[var(--sf-color-border)]'}`}
      >
        {items.map((item, index) => (
          <details
            key={index}
            className={`${block.variant === 'cards' ? 'border border-[var(--sf-color-border)] p-6' : 'border-b border-[var(--sf-color-border)] py-5'} group`}
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-5 text-base font-medium leading-8">
              {contentText(item, 'question')}
              <span aria-hidden="true" className="text-xl font-normal group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pt-4 text-sm leading-8 text-[var(--sf-color-muted)]">
              {contentText(item, 'answer')}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function RelatedProductCard({ product }: Readonly<{ product: PublicGuideRelatedProduct }>) {
  return (
    <li className="group">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-[var(--sf-color-surface)]"
      >
        {product.primaryMedia?.url ? (
          <StorefrontImage
            src={product.primaryMedia.url}
            alt={product.primaryMedia.altText?.trim() || product.name}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"
          />
        ) : (
          <span className="flex h-full items-center justify-center p-6 text-center text-xs text-[var(--sf-color-subtle)]">
            {product.name}
          </span>
        )}
      </Link>
      <h3 className="mt-4 text-base font-medium">
        <Link href={`/products/${product.slug}`}>{product.name}</Link>
      </h3>
      {product.salePriceToman !== null ? (
        <p className="mt-2 text-sm text-[var(--sf-color-muted)]">
          {formatTomanPrice(product.salePriceToman)}
        </p>
      ) : null}
    </li>
  );
}

function ProductCardsBlock({
  block,
  products,
}: Readonly<{ block: PublicGuideBlock; products: readonly PublicGuideRelatedProduct[] }>) {
  if (!products.length) return null;
  return (
    <section id={safeAnchor(block.anchorId)} className="scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-3xl font-normal sm:text-4xl">
          {contentText(block.content, 'heading') || 'انتخاب‌های مرتبط'}
        </h2>
        <Link href="/products" className="border-b border-[var(--sf-color-ink)] pb-1 text-sm">
          مشاهده همه محصولات
        </Link>
      </div>
      <ul
        className={`mt-8 grid gap-5 ${block.variant === 'carousel' ? 'grid-flow-col auto-cols-[72%] overflow-x-auto sm:auto-cols-[42%] lg:auto-cols-[27%]' : 'grid-cols-2 lg:grid-cols-4'}`}
      >
        {products.map((product) => (
          <RelatedProductCard key={product.id} product={product} />
        ))}
      </ul>
    </section>
  );
}

function CtaBlock({ block }: Readonly<{ block: PublicGuideBlock }>) {
  const href = safeInternalHref(contentText(block.content, 'buttonHref'));
  return (
    <section
      id={safeAnchor(block.anchorId)}
      className={`scroll-mt-28 grid gap-7 p-8 sm:p-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end ${block.variant === 'soft' ? 'bg-[#f0ece3]' : 'bg-[#171717] text-white'}`}
    >
      <div>
        <h2 className="text-3xl font-normal sm:text-4xl">
          {contentText(block.content, 'heading')}
        </h2>
        {contentText(block.content, 'body') ? (
          <p
            className={`mt-5 max-w-2xl text-sm leading-8 ${block.variant === 'soft' ? 'text-[var(--sf-color-muted)]' : 'text-white/70'}`}
          >
            {contentText(block.content, 'body')}
          </p>
        ) : null}
      </div>
      {href && contentText(block.content, 'buttonLabel') ? (
        <ButtonLink
          href={href}
          variant={block.variant === 'soft' ? 'solid' : 'outline'}
          className={block.variant === 'soft' ? '' : 'border-white/50 text-white'}
        >
          {contentText(block.content, 'buttonLabel')}
        </ButtonLink>
      ) : null}
    </section>
  );
}

function ArticleBlock({
  block,
  article,
}: Readonly<{ block: PublicGuideBlock; article: PublicGuideArticle }>) {
  switch (block.type) {
    case 'LEAD':
      return <LeadBlock block={block} />;
    case 'RICH_TEXT':
      return <TextBlock block={block} />;
    case 'IMAGE':
    case 'GALLERY':
      return (
        <GuideImage
          block={block}
          className={block.variant === 'contained' ? 'mx-auto max-w-4xl' : ''}
        />
      );
    case 'IMAGE_TEXT':
      return <ImageTextBlock block={block} />;
    case 'STEPS':
      return <StepsBlock block={block} />;
    case 'QUOTE':
      return <QuoteBlock block={block} />;
    case 'TABLE':
      return <TableBlock block={block} />;
    case 'FAQ':
      return <FaqBlock block={block} />;
    case 'PRODUCT_CARDS':
      return <ProductCardsBlock block={block} products={article.relatedProducts} />;
    case 'CTA':
      return <CtaBlock block={block} />;
    case 'DIVIDER':
      return block.variant === 'ornament' ? (
        <div
          aria-hidden="true"
          className="flex items-center justify-center gap-3 py-2 text-[#a98d46]"
        >
          <span className="h-px w-12 bg-current" />
          <span className="size-2 rotate-45 border border-current" />
          <span className="h-px w-12 bg-current" />
        </div>
      ) : (
        <hr className="border-0 border-t border-[var(--sf-color-border)]" />
      );
  }
}

export function KnowledgeArticle({ article }: Readonly<{ article: PublicGuideArticle }>) {
  const toc = article.blocks.flatMap((block) => {
    const anchor = safeAnchor(block.anchorId);
    const heading = contentText(block.content, 'heading');
    return anchor && heading ? [{ anchor, heading }] : [];
  });
  const published = article.publishedAt ? new Date(article.publishedAt) : null;
  const publishedLabel =
    published && !Number.isNaN(published.getTime()) ? date.format(published) : null;

  return (
    <main id="main-content">
      <header
        className={`relative isolate overflow-hidden ${article.heroMedia?.url ? 'aspect-[1086/1448] text-white lg:aspect-[1942/809]' : 'bg-[#ece8df] py-20 sm:py-28'}`}
      >
        {article.heroMedia?.url ? (
          <ResponsiveHeroImage
            desktopSrc={article.heroMedia.url}
            mobileSrc={article.heroMobileMedia?.url}
            alt={article.heroMedia.altText?.trim() || article.title}
            preload
            className="-z-20 object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute -bottom-48 -left-20 -z-20 size-[34rem] rounded-full bg-[radial-gradient(circle_at_40%_35%,#fff_0,#cfc8bb_38%,#776f63_75%)]"
          />
        )}
        {article.heroMedia?.url ? (
          <div className="absolute inset-0 -z-10 bg-gradient-to-l from-black/70 via-black/30 to-black/10" />
        ) : null}
        <div
          className={`sf-container flex h-full items-end ${article.heroMedia?.url ? 'pb-12 pt-28 lg:pb-20' : ''}`}
        >
          <div className="max-w-4xl">
            <StorefrontBreadcrumbs
              items={[
                { label: 'خانه', href: '/' },
                { label: 'دانستنی‌ها', href: '/guide' },
                { label: article.title, href: `/guide/${article.slug}` },
              ]}
              className={`mb-7 ${article.heroMedia?.url ? 'text-white/70' : 'text-[var(--sf-color-muted)]'}`}
            />
            <p
              className={`text-xs tracking-[0.16em] ${article.heroMedia?.url ? 'text-white/65' : 'text-[var(--sf-color-subtle)]'}`}
            >
              {article.eyebrow || guideFormatLabel(article.format)}
            </p>
            <h1 className="mt-5 text-[clamp(2.6rem,6.8vw,6.2rem)] font-normal leading-[1.2]">
              {article.title}
            </h1>
            {article.excerpt ? (
              <p
                className={`mt-7 max-w-3xl text-base leading-9 sm:text-xl sm:leading-10 ${article.heroMedia?.url ? 'text-white/78' : 'text-[var(--sf-color-muted)]'}`}
              >
                {article.excerpt}
              </p>
            ) : null}
            <div
              className={`mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs ${article.heroMedia?.url ? 'text-white/55' : 'text-[var(--sf-color-subtle)]'}`}
            >
              {publishedLabel ? <span>به‌روزرسانی {publishedLabel}</span> : null}
              {article.readingTimeMinutes ? (
                <span>{number.format(article.readingTimeMinutes)} دقیقه مطالعه</span>
              ) : null}
              {article.topics.map((topic) => (
                <Link key={topic.id} href={`/guide?topic=${encodeURIComponent(topic.slug)}`}>
                  #{topic.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      {toc.length ? (
        <nav
          aria-label="در این دانستنی"
          className="sticky top-16 z-20 border-b border-[var(--sf-color-border)] bg-[color:var(--sf-color-canvas)/0.94] backdrop-blur-md"
        >
          <div className="sf-container flex gap-8 overflow-x-auto py-4 text-sm whitespace-nowrap sm:gap-12">
            {toc.map((item) => (
              <a
                key={item.anchor}
                href={`#${item.anchor}`}
                className="transition-opacity hover:opacity-50"
              >
                {item.heading}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      <article className="sf-container py-14 sm:py-20">
        <div className="mx-auto max-w-6xl space-y-16 sm:space-y-24">
          {article.blocks.map((block) => (
            <ArticleBlock key={block.id} block={block} article={article} />
          ))}
        </div>
      </article>

      {article.relatedCategories.length || article.relatedBrands.length ? (
        <aside className="sf-container pb-14 sm:pb-20" aria-label="مسیرهای مرتبط برای ادامه">
          <div className="border-y border-[var(--sf-color-border)] py-7">
            <p className="text-xs tracking-[0.16em] text-[var(--sf-color-subtle)]">
              برای ادامه بررسی
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {article.relatedCategories.map((category) => (
                <Link
                  key={`category-${category.id}`}
                  href={`/categories/${category.slug}`}
                  className="border border-[var(--sf-color-border)] px-4 py-2 text-sm text-[var(--sf-color-muted)] transition-colors hover:border-[var(--sf-color-ink)] hover:text-[var(--sf-color-ink)]"
                >
                  محصولات {category.name}
                </Link>
              ))}
              {article.relatedBrands.map((brand) => (
                <Link
                  key={`brand-${brand.id}`}
                  href={`/brands/${brand.slug}`}
                  className="border border-[var(--sf-color-border)] px-4 py-2 text-sm text-[var(--sf-color-muted)] transition-colors hover:border-[var(--sf-color-ink)] hover:text-[var(--sf-color-ink)]"
                >
                  آشنایی با {brand.name}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      ) : null}

      {article.relatedArticles.length ? (
        <div className="sf-container pb-14 sm:pb-20">
          <RelatedKnowledgeSection
            articles={article.relatedArticles}
            eyebrow="پاسخ‌های نزدیک به این موضوع"
            title="شاید پرسش بعدی شما اینجا باشد"
            headingId="related-article-guides-title"
          />
        </div>
      ) : null}

      <aside className="bg-[#171717] py-14 text-white sm:py-20">
        <div className="sf-container flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs tracking-[0.16em] text-white/50">پرسش بعدی شما چیست؟</p>
            <h2 className="mt-4 text-3xl font-normal sm:text-5xl">دانستنی‌های بیشتری کشف کنید.</h2>
          </div>
          <ButtonLink href="/guide" variant="outline" className="border-white/45 text-white">
            بازگشت به دانستنی‌ها
          </ButtonLink>
        </div>
      </aside>
    </main>
  );
}
