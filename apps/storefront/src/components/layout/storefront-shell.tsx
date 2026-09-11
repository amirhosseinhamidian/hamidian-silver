import {
  StorefrontFooter,
  type StorefrontFooterContent,
} from '@/components/layout/storefront-footer';
import { StorefrontHeader } from '@/components/layout/storefront-header';
import { SkipToContentLink } from '@/components/layout/skip-to-content-link';
import type { StorefrontAnnouncement } from '@/components/layout/storefront-announcement';
import type { StorefrontNavigationCategory } from '@/components/layout/storefront-header';
import type { ReactNode } from 'react';

type StorefrontShellProps = Readonly<{
  children: ReactNode;
  footerContent?: StorefrontFooterContent | null;
  announcement?: StorefrontAnnouncement | null;
  navigationCategories?: readonly StorefrontNavigationCategory[];
  authenticated?: boolean;
}>;

export function StorefrontShell({
  children,
  footerContent,
  announcement,
  navigationCategories = [],
  authenticated = false,
}: StorefrontShellProps) {
  return (
    <div
      data-app-shell="storefront"
      className="
        flex min-h-dvh flex-col bg-[var(--sf-color-canvas)]
        text-[var(--sf-color-ink)]
      "
    >
      <SkipToContentLink />
      <StorefrontHeader
        authenticated={authenticated}
        announcement={announcement}
        navigationCategories={navigationCategories}
      />
      <div className="flex-1">{children}</div>
      <StorefrontFooter content={footerContent} />
    </div>
  );
}
