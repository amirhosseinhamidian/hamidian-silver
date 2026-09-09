import { StorefrontContentPage } from '@/components/content/storefront-content-page';
import { getPublicContentPage } from '@/lib/content/public-content-page';
import { getContentPageMetadata } from '@/lib/seo/content-metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return getContentPageMetadata('PRIVACY', '/privacy');
}

export default async function PrivacyPage() {
  const page = await getPublicContentPage('PRIVACY');
  return <StorefrontContentPage page={page} kind="legal" />;
}
