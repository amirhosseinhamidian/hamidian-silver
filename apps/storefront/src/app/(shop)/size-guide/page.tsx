import type { Metadata } from 'next';

import { StorefrontSizeGuide } from '@/components/content/storefront-size-guide';
import { getPublicContentPage } from '@/lib/content/public-content-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublicContentPage('SIZE_GUIDE');
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? page.subtitle };
}

export default async function SizeGuidePage() {
  const page = await getPublicContentPage('SIZE_GUIDE');
  return <StorefrontSizeGuide page={page} />;
}
