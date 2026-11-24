import type { Metadata } from 'next';
import { FestivalPreviewBridge } from '@/components/campaigns/festival-preview-bridge';

export const metadata: Metadata = {
  title: 'پیش‌نمایش جشنواره',
  robots: { index: false, follow: false },
};

export default async function CampaignPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ frame?: string; device?: string; nonce?: string }>;
}) {
  const { frame, device, nonce } = await searchParams;
  return (
    <FestivalPreviewBridge
      frame={frame === '1'}
      device={device === 'mobile' ? 'mobile' : 'desktop'}
      frameNonce={typeof nonce === 'string' ? nonce : ''}
      adminOrigin={process.env.ADMIN_APP_ORIGIN?.trim() || 'https://admin.hamidian.shop'}
    />
  );
}
