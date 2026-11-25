import { CampaignNavigationItem } from '@/components/layout/campaign-navigation-item';
import { CampaignPlacementRollover } from '@/components/layout/campaign-placement-rollover';
import type { PublicCampaignBanner } from '@/lib/home/public-campaign-banner';
import { StorefrontAnnouncementBar } from '@/components/layout/storefront-announcement';
import {
  getInitialCountdownSeconds,
  type StorefrontAnnouncement,
} from '@/components/layout/storefront-announcement-config';
import { AccountHeaderAction } from '@/components/auth/auth-modal';
import { CartHeaderLink } from '@/components/cart/cart-header-link';
import { StorefrontMobileMenu } from '@/components/layout/storefront-mobile-menu';
import { StorefrontSearch } from '@/components/layout/storefront-search';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FiMapPin } from 'react-icons/fi';

import { WishlistHeaderLink } from '@/components/wishlist/wishlist-header-link';

export type StorefrontNavigationCategory = Readonly<{
  id: string;
  label: string;
  slug: string;
}>;

type StorefrontHeaderProps = Readonly<{
  announcement?: StorefrontAnnouncement | null;
  campaignCountdown?: PublicCampaignBanner | null;
  campaignNavigation?: PublicCampaignBanner | null;
  navigationCategories?: readonly StorefrontNavigationCategory[];
  authenticated?: boolean;
  preview?: boolean;
}>;

function IconLink({
  href,
  label,
  children,
}: Readonly<{
  href: string;
  label: string;
  children: ReactNode;
}>) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="
        inline-flex size-9 items-center justify-center
        transition-opacity duration-150 hover:opacity-55
      "
    >
      {children}
    </Link>
  );
}

export function StorefrontHeader({
  announcement,
  campaignCountdown,
  campaignNavigation,
  navigationCategories = [],
  authenticated = false,
  preview = false,
}: StorefrontHeaderProps) {
  const initialRemainingSeconds = announcement
    ? getInitialCountdownSeconds(announcement.countdown)
    : null;

  return (
    <>
      {!preview && (campaignCountdown || campaignNavigation) && (
        <CampaignPlacementRollover
          announcement={campaignCountdown}
          navigation={campaignNavigation}
        />
      )}
      <StorefrontAnnouncementBar
        preview={preview}
        announcement={announcement}
        initialRemainingSeconds={initialRemainingSeconds}
        campaign={campaignCountdown}
        campaignSeconds={
          campaignCountdown
            ? (getInitialCountdownSeconds({
                mode: 'deadline',
                endsAt: campaignCountdown.countdownEndsAt ?? campaignCountdown.endsAt,
              }) ?? 0)
            : 0
        }
      />

      <div className="hidden border-b border-[var(--sf-color-border)] lg:block">
        <div className="sf-container grid min-h-24 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <nav
            aria-label="لینک‌های اطلاعاتی"
            className="
              hidden items-center gap-7 text-sm
              text-[var(--sf-color-muted)] xl:flex
            "
          >
            <Link prefetch={preview ? false : undefined} href="/services">
              خدمات ما
            </Link>
            <Link prefetch={preview ? false : undefined} href="/faq">
              سوالات متداول
            </Link>
            <Link prefetch={preview ? false : undefined} href="/size-guide">
              راهنمای سایز
            </Link>
            <Link prefetch={preview ? false : undefined} href="/contact">
              تماس با ما
            </Link>
            <Link prefetch={preview ? false : undefined} href="/about">
              درباره گالری حمیدیان
            </Link>
          </nav>

          <Link
            href="/"
            prefetch={preview ? false : undefined}
            aria-label="گالری حمیدیان، صفحه اصلی"
            className="relative col-start-2 h-16 w-40 sm:h-20 sm:w-56"
          >
            <Image
              src="/brand/hamidian-signature.png"
              alt="لوگوی گالری حمیدیان"
              fill
              sizes="224px"
              loading="eager"
              className="scale-110 object-contain"
            />
          </Link>

          <div className="flex items-center justify-end gap-1">
            {!preview && (
              <>
                <WishlistHeaderLink />
                <AccountHeaderAction authenticated={authenticated} />
                <span className="hidden sm:inline-flex">
                  <IconLink href="/contact" label="نشانی گالری">
                    <FiMapPin aria-hidden="true" size={21} />
                  </IconLink>
                </span>
                <CartHeaderLink />
              </>
            )}
          </div>
        </div>
      </div>

      <header
        className="
          sticky top-0 z-40 border-b border-[var(--sf-color-border)]
          bg-[var(--sf-color-canvas)]
        "
      >
        <div
          dir="ltr"
          className="
            sf-container grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-2
            lg:min-h-0
          "
        >
          <div
            data-testid="storefront-header-search-slot"
            className="flex items-center justify-start gap-1 lg:col-start-3 lg:row-start-1 lg:justify-self-end"
          >
            <div className="lg:hidden">
              <StorefrontMobileMenu
                preview={preview}
                navigationCategories={navigationCategories}
                campaign={campaignNavigation}
              />
            </div>
            {!preview && <StorefrontSearch />}
          </div>

          <Link
            href="/"
            prefetch={preview ? false : undefined}
            aria-label="گالری حمیدیان، صفحه اصلی موبایل"
            className="relative h-11 w-28 lg:hidden"
          >
            <Image
              src="/brand/hamidian-signature.png"
              alt=""
              fill
              sizes="7rem"
              loading="eager"
              className="scale-110 object-contain"
            />
          </Link>

          <nav
            dir="rtl"
            aria-label="پیمایش اصلی"
            className="hidden min-w-0 overflow-x-auto lg:col-start-2 lg:row-start-1 lg:block lg:justify-self-center"
          >
            <ul className="flex min-w-max items-center justify-center gap-9 py-4 text-sm">
              <li>
                <Link prefetch={preview ? false : undefined} href="/">
                  خانه
                </Link>
              </li>

              {campaignNavigation && (
                <CampaignNavigationItem campaign={campaignNavigation} preview={preview} />
              )}

              {navigationCategories.map((category) => (
                <li key={category.id}>
                  <Link
                    prefetch={preview ? false : undefined}
                    href={`/categories/${category.slug}`}
                  >
                    {category.label}
                  </Link>
                </li>
              ))}

              <li>
                <Link prefetch={preview ? false : undefined} href="/brands">
                  برندها
                </Link>
              </li>
              <li>
                <Link prefetch={preview ? false : undefined} href="/products?sort=newest">
                  جدیدترین‌ها
                </Link>
              </li>
              <li>
                <Link prefetch={preview ? false : undefined} href="/guide">
                  دانستنی‌ها
                </Link>
              </li>
            </ul>
          </nav>

          <div className="flex items-center justify-end gap-1 lg:hidden">
            {!preview && (
              <>
                <AccountHeaderAction authenticated={authenticated} />
                <WishlistHeaderLink />
                <CartHeaderLink />
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
