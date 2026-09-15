import { StorefrontSizeGuide } from '@/components/content/storefront-size-guide';
import { getPublicContentPage } from '@/lib/content/public-content-page';
import { getContentPageMetadata } from '@/lib/seo/content-metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return getContentPageMetadata('SIZE_GUIDE', '/size-guide');
}

export default async function SizeGuidePage() {
  const page = await getPublicContentPage('SIZE_GUIDE');
  return <StorefrontSizeGuide page={page} />;
}
