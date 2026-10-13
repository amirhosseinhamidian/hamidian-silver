import type { Metadata } from 'next';

import { KnowledgeHub } from '@/components/guide/knowledge-hub';
import { JsonLd } from '@/components/seo/json-ld';
import {
  getPublicGuideArticles,
  getPublicGuideTopics,
  parseGuideSearchParams,
  type GuideSearchParams,
} from '@/lib/guide/public-guide';
import { buildStorefrontPageMetadata } from '@/lib/seo/metadata';
import { buildGuideCollectionStructuredData } from '@/lib/seo/structured-data';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const dynamic = 'force-dynamic';

type GuidePageProps = Readonly<{ searchParams?: Promise<GuideSearchParams> }>;

export async function generateMetadata({ searchParams }: GuidePageProps): Promise<Metadata> {
  const [settings, rawSearchParams] = await Promise.all([
    getPublicSiteSettings(),
    searchParams ?? Promise.resolve({}),
  ]);
  return buildStorefrontPageMetadata(settings, {
    pathname: '/guide',
    searchParams: rawSearchParams,
    title: 'دانستنی‌ها؛ پاسخ‌ها و راهنمای انتخاب بهتر',
    description:
      'پاسخ پرسش‌های رایج و راهنماهای کاربردی برای شناخت، انتخاب، خرید و نگهداری نقره، ساعت و دیگر محصولات.',
  });
}

export default async function GuidePage({ searchParams }: GuidePageProps) {
  const filters = parseGuideSearchParams(await (searchParams ?? Promise.resolve({})));
  const [articles, topics] = await Promise.all([
    getPublicGuideArticles(filters),
    getPublicGuideTopics(),
  ]);
  return (
    <>
      <JsonLd data={buildGuideCollectionStructuredData(articles)} />
      <KnowledgeHub articles={articles} topics={topics} filters={filters} />
    </>
  );
}
