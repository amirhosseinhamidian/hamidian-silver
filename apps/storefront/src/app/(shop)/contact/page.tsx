import { StorefrontContentPage } from '@/components/content/storefront-content-page';
import { getPublicContentPage } from '@/lib/content/public-content-page';
import { getContentPageMetadata } from '@/lib/seo/content-metadata';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return getContentPageMetadata('CONTACT', '/contact');
}

export default async function ContactPage() {
  const [page, settings] = await Promise.all([
    getPublicContentPage('CONTACT'),
    getPublicSiteSettings(),
  ]);
  return <StorefrontContentPage page={page} kind="contact" settings={settings} />;
}
