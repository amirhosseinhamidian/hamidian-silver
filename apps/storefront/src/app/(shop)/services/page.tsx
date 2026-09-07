import type { Metadata } from 'next';

import { StorefrontContentPage } from '@/components/content/storefront-content-page';
import { getPublicContentPage } from '@/lib/content/public-content-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublicContentPage('SERVICES');
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? page.subtitle };
}

export default async function ServicesPage() {
  const page = await getPublicContentPage('SERVICES');
  return <StorefrontContentPage page={page} kind="services" />;
}
