import { StorefrontContentPage } from '@/components/content/storefront-content-page';
import { getPublicContentPage } from '@/lib/content/public-content-page';
import { getContentPageMetadata } from '@/lib/seo/content-metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return getContentPageMetadata('SERVICES', '/services');
}

export default async function ServicesPage() {
  const page = await getPublicContentPage('SERVICES');
  return <StorefrontContentPage page={page} kind="services" />;
}
