import type { Metadata } from 'next';

import { StorefrontContentPage } from '@/components/content/storefront-content-page';
import { getPublicContentPage } from '@/lib/content/public-content-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublicContentPage('PRIVACY');
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? page.subtitle };
}

export default async function PrivacyPage() {
  const page = await getPublicContentPage('PRIVACY');
  return <StorefrontContentPage page={page} kind="legal" />;
}
