import type { Metadata } from 'next';

import { StorefrontFaq } from '@/components/content/storefront-faq';
import { getPublicContentPage } from '@/lib/content/public-content-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublicContentPage('FAQ');
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? page.subtitle };
}

export default async function FaqPage() {
  const page = await getPublicContentPage('FAQ');
  return <StorefrontFaq page={page} />;
}
