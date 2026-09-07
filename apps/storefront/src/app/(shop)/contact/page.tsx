import type { Metadata } from 'next';

import { StorefrontContentPage } from '@/components/content/storefront-content-page';
import { getPublicContentPage } from '@/lib/content/public-content-page';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublicContentPage('CONTACT');
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? page.subtitle };
}

export default async function ContactPage() {
  const [page, settings] = await Promise.all([
    getPublicContentPage('CONTACT'),
    getPublicSiteSettings(),
  ]);
  return <StorefrontContentPage page={page} kind="contact" settings={settings} />;
}
