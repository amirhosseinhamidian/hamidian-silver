'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import Link from 'next/link';
import { FiMenu, FiX } from 'react-icons/fi';

import type { StorefrontNavigationCategory } from '@/components/layout/storefront-header';

type StorefrontMobileMenuProps = Readonly<{
  navigationCategories: readonly StorefrontNavigationCategory[];
}>;

const utilityLinks = [
  { href: '/brands', label: 'برندها' },
  { href: '/products?sort=newest', label: 'جدیدترین‌ها' },
  { href: '/wishlist', label: 'علاقه‌مندی‌ها' },
  { href: '/account', label: 'حساب کاربری' },
  { href: '/services', label: 'خدمات ما' },
  { href: '/contact', label: 'تماس با ما' },
  { href: '/about', label: 'درباره گالری حمیدیان' },
] as const;

export function StorefrontMobileMenu({
  navigationCategories,
}: StorefrontMobileMenuProps) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="باز کردن منوی موبایل"
          className="
            inline-flex size-9 items-center justify-center
            transition-opacity duration-150 hover:opacity-55
          "
        >
          <FiMenu aria-hidden="true" size={22} />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="
            fixed inset-0 z-[90] bg-black/35
            data-[state=closed]:animate-[sf-overlay-close_420ms_cubic-bezier(0.16,1,0.3,1)_forwards]
            data-[state=open]:animate-[sf-overlay-open_480ms_cubic-bezier(0.16,1,0.3,1)]
          "
        />
        <DialogPrimitive.Content
          dir="rtl"
          className="
            fixed inset-y-0 left-0 z-[100] flex w-[min(22rem,88vw)] flex-col
            border-r border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)]
            px-5 pb-8 pt-5 shadow-lg outline-none
            focus:outline-none focus-visible:outline-none focus-visible:ring-0
          "
        >
          <div className="flex items-center justify-between gap-4">
            <DialogPrimitive.Title className="text-lg font-medium">
              منوی فروشگاه
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="بستن منوی موبایل"
              className="
                inline-flex size-10 items-center justify-center
                rounded-[var(--sf-radius-md)] border border-[var(--sf-color-border)]
                transition-colors hover:border-[var(--sf-color-ink)]
              "
            >
              <FiX aria-hidden="true" size={21} />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className="sr-only">
            دسترسی به بخش‌های اصلی فروشگاه نقره حمیدیان.
          </DialogPrimitive.Description>

          <nav aria-label="منوی موبایل" className="mt-8 overflow-y-auto">
            <ul className="divide-y divide-[var(--sf-color-border)] border-y border-[var(--sf-color-border)]">
              <li>
                <DialogPrimitive.Close asChild>
                  <Link href="/" className="block py-4 text-sm">
                    خانه
                  </Link>
                </DialogPrimitive.Close>
              </li>

              {navigationCategories.map((category) => (
                <li key={category.id}>
                  <DialogPrimitive.Close asChild>
                    <Link href={`/categories/${category.slug}`} className="block py-4 text-sm">
                      {category.label}
                    </Link>
                  </DialogPrimitive.Close>
                </li>
              ))}

              {utilityLinks.map((link) => (
                <li key={link.href}>
                  <DialogPrimitive.Close asChild>
                    <Link href={link.href} className="block py-4 text-sm">
                      {link.label}
                    </Link>
                  </DialogPrimitive.Close>
                </li>
              ))}
            </ul>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
