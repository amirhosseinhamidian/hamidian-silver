import { StorefrontFaq } from '@/components/content/storefront-faq';
import { getPublicContentPage } from '@/lib/content/public-content-page';
import { getContentPageMetadata } from '@/lib/seo/content-metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return getContentPageMetadata('FAQ', '/faq');
}

export default async function FaqPage() {
  const page = await getPublicContentPage('FAQ');
  return <StorefrontFaq page={page} />;
}
