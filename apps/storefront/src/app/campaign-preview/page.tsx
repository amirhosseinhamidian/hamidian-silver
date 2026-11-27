import type { Metadata } from 'next';
import { FestivalPreviewBridge } from '@/components/campaigns/festival-preview-bridge';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'پیش‌نمایش جشنواره',
  robots: { index: false, follow: false },
};

export default async function CampaignPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ frame?: string; nonce?: string }>;
}) {
  const { frame, nonce } = await searchParams;
  const configured =
    process.env.ADMIN_APP_ORIGIN?.trim() ||
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3002'
      : 'https://admin.hamidian.shop');
  const adminOrigin = new URL(configured).origin;
  return (
    <FestivalPreviewBridge
      frame={frame === '1'}
      frameNonce={typeof nonce === 'string' ? nonce : ''}
      adminOrigin={adminOrigin}
      navigationCategories={frame === '1' ? (await getPublicSiteSettings()).headerCategories : []}
    />
  );
}
