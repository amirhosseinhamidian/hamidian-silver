import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

import { KnowledgeArticle } from '@/components/guide/knowledge-article';
import { JsonLd } from '@/components/seo/json-ld';
import { getPublicGuideArticle, type GuideSearchParams } from '@/lib/guide/public-guide';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import { getPublicSeoRedirect } from '@/lib/seo/redirects';
import {
  buildGuideArticleStructuredData,
  buildGuideFaqStructuredData,
} from '@/lib/seo/structured-data';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const dynamic = 'force-dynamic';

type GuideArticlePageProps = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams?: Promise<GuideSearchParams>;
}>;

export async function generateMetadata({
  params,
  searchParams,
}: GuideArticlePageProps): Promise<Metadata> {
  const [{ slug }, rawSearchParams, settings] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
    getPublicSiteSettings(),
  ]);
  const article = await getPublicGuideArticle(slug);
  if (!article) return { title: 'دانستنی یافت نشد', robots: { index: false, follow: false } };
  return buildStorefrontPageMetadata(settings, {
    pathname: `/guide/${article.slug}`,
    searchParams: rawSearchParams,
    title: article.title,
    description: article.excerpt,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    seoCanonicalPath: article.seoCanonicalPath,
    seoNoIndex: article.seoNoIndex,
    seoOgMedia: article.seoOgMedia,
    fallbackMedia: article.heroMedia,
    openGraphType: 'article',
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
  });
}

export default async function GuideArticlePage({ params }: GuideArticlePageProps) {
  const { slug } = await params;
  const [article, settings] = await Promise.all([
    getPublicGuideArticle(slug),
    getPublicSiteSettings(),
  ]);
  if (!article) {
    const destinationPath = await getPublicSeoRedirect(`/guide/${slug}`);
    if (destinationPath) permanentRedirect(destinationPath);
    notFound();
  }
  const faq = buildGuideFaqStructuredData(article);
  return (
    <>
      <JsonLd data={buildGuideArticleStructuredData(article, settings)} />
      {faq ? <JsonLd data={faq} /> : null}
      <KnowledgeArticle article={article} />
    </>
  );
}
