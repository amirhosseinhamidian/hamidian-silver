import { StorefrontFaq } from '@/components/content/storefront-faq';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import { getPublicContentPage } from '@/lib/content/public-content-page';
import { getContentPageMetadata } from '@/lib/seo/content-metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return getContentPageMetadata('FAQ', '/faq');
}

export default async function FaqPage() {
  const page = await getPublicContentPage('FAQ');
  return (
    <StorefrontFaq
      page={page}
      breadcrumbs={
        <StorefrontBreadcrumbs
          items={[
            { label: 'خانه', href: '/' },
            { label: page.title, href: '/faq' },
          ]}
          className="mb-7 text-white/70"
        />
      }
    />
  );
}
