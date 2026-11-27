import { cookies } from 'next/headers';

import { StorefrontShell } from '@/components/layout/storefront-shell';
import type { StorefrontAnnouncement } from '@/components/layout/storefront-announcement';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { CampaignVisibilityProvider } from '@/lib/campaigns/campaign-visibility';
import { getPublicCampaignPlacement } from '@/lib/campaigns/public-campaigns';
import { getPublicSiteSettings } from '@/lib/site-settings/public-site-settings';
import type { ReactNode } from 'react';
import { PromotionProvider } from '@/lib/promotions/promotion-context';
import { getPublicPromotions } from '@/lib/promotions/public-promotions';

type ShopLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ShopLayout({ children }: ShopLayoutProps) {
  const authenticated = Boolean((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  const [settings, promotions, campaignCountdown, campaignNavigation] = await Promise.all([
    getPublicSiteSettings(),
    getPublicPromotions(),
    getPublicCampaignPlacement('COUNTDOWN'),
    getPublicCampaignPlacement('NAVIGATION'),
  ]);
  const announcement: StorefrontAnnouncement = {
    enabled: settings.announcement.enabled,
    message: settings.announcement.message ?? '',
    countdown:
      settings.announcement.countdownMode === 'FIXED' && settings.announcement.durationSeconds
        ? { mode: 'fixed', durationSeconds: settings.announcement.durationSeconds }
        : settings.announcement.countdownMode === 'DEADLINE' && settings.announcement.endsAt
          ? { mode: 'deadline', endsAt: settings.announcement.endsAt }
          : { mode: 'none' },
    cta: {
      enabled: Boolean(settings.announcement.ctaLabel && settings.announcement.ctaHref),
      label: settings.announcement.ctaLabel ?? '',
      href: settings.announcement.ctaHref ?? '',
    },
  };

  return (
    <CampaignVisibilityProvider>
      <StorefrontShell
        authenticated={authenticated}
        announcement={announcement}
        campaignCountdown={campaignCountdown}
        campaignNavigation={campaignNavigation}
        navigationCategories={settings.headerCategories}
        footerContent={{
          galleryName: settings.galleryName,
          about: settings.footerAbout,
          address: settings.contactAddress,
          phoneNumbers: settings.contactPhoneNumbers,
          email: settings.contactEmail,
          social: {
            instagram: settings.instagramUrl,
            telegram: settings.telegramUrl,
            bale: settings.baleUrl,
          },
        }}
      >
        <PromotionProvider promotions={promotions}>{children}</PromotionProvider>
      </StorefrontShell>
    </CampaignVisibilityProvider>
  );
}
