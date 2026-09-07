import { StorefrontHome } from '@/components/home/storefront-home';
import { getPublicHomepage } from '@/lib/home/public-homepage';

export const dynamic = 'force-dynamic';

export default async function StorefrontHomePage() {
  const homepage = await getPublicHomepage();

  return <StorefrontHome homepage={homepage} />;
}
