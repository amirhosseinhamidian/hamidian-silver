import {
  getInitialCountdownSeconds,
  StorefrontAnnouncementBar,
  type StorefrontAnnouncement,
} from '@/components/layout/storefront-announcement';
import { CartHeaderLink } from '@/components/cart/cart-header-link';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FiHeart, FiMapPin, FiSearch, FiUser } from 'react-icons/fi';

export type StorefrontNavigationCategory = Readonly<{
  id: string;
  label: string;
  slug: string;
}>;

type StorefrontHeaderProps = Readonly<{
  announcement?: StorefrontAnnouncement | null;
  navigationCategories?: readonly StorefrontNavigationCategory[];
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
  navigationCategories = [],
}: StorefrontHeaderProps) {
  const initialRemainingSeconds = announcement
    ? getInitialCountdownSeconds(announcement.countdown)
    : null;

  return (
    <header>
      <StorefrontAnnouncementBar
        announcement={announcement}
        initialRemainingSeconds={initialRemainingSeconds}
      />

      <div className="border-b border-[var(--sf-color-border)]">
        <div className="sf-container grid min-h-24 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <nav
            aria-label="لینک‌های اطلاعاتی"
            className="
              hidden items-center gap-7 text-sm
              text-[var(--sf-color-muted)] xl:flex
            "
          >
            <Link href="/services">خدمات ما</Link>
            <Link href="/contact">تماس با ما</Link>
            <Link href="/about">درباره گالری حمیدیان</Link>
          </nav>

          <Link
            href="/"
            aria-label="نقره حمیدیان، صفحه اصلی"
            className="relative col-start-2 h-16 w-40 sm:h-20 sm:w-56"
          >
            <Image
              src="/brand/hamidian-signature.png"
              alt="لوگوی نقره حمیدیان"
              fill
              priority
              sizes="(min-width: 640px)"
              className="object-contain scale-110"
            />
          </Link>

          <div className="flex items-center justify-end gap-1">
            <IconLink href="/wishlist" label="علاقه‌مندی‌ها">
              <FiHeart aria-hidden="true" size={21} />
            </IconLink>
            <IconLink href="/account" label="حساب کاربری">
              <FiUser aria-hidden="true" size={21} />
            </IconLink>
            <span className="hidden sm:inline-flex">
              <IconLink href="/contact" label="نشانی گالری">
                <FiMapPin aria-hidden="true" size={21} />
              </IconLink>
            </span>
            <CartHeaderLink />
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--sf-color-border)]">
        <div className="sf-container flex items-center gap-4">
          <IconLink href="/products" label="جستجو در محصولات">
            <FiSearch aria-hidden="true" size={22} />
          </IconLink>

          <nav aria-label="پیمایش اصلی" className="min-w-0 flex-1 overflow-x-auto">
            <ul className="flex min-w-max items-center gap-9 py-4 text-sm">
              <li>
                <Link href="/">خانه</Link>
              </li>

              {navigationCategories.map((category) => (
                <li key={category.id}>
                  <Link href={`/categories/${category.slug}`}>{category.label}</Link>
                </li>
              ))}

              <li>
                <Link href="/brands">برندها</Link>
              </li>
              <li>
                <Link href="/products?sort=newest">جدیدترین‌ها</Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
