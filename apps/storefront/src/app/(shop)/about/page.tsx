import { StorefrontContentPage } from '@/components/content/storefront-content-page';
import { getPublicContentPage } from '@/lib/content/public-content-page';
import { getContentPageMetadata } from '@/lib/seo/content-metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return getContentPageMetadata('ABOUT', '/about');
}

export default async function AboutPage() {
  const page = await getPublicContentPage('ABOUT');
  return <StorefrontContentPage page={page} kind="about" />;
}
