import {
  StorefrontFooter,
  type StorefrontFooterContent,
} from '@/components/layout/storefront-footer';
import { StorefrontHeader } from '@/components/layout/storefront-header';
import type { ReactNode } from 'react';

type StorefrontShellProps = Readonly<{
  children: ReactNode;
  footerContent?: StorefrontFooterContent | null;
}>;

export function StorefrontShell({ children, footerContent }: StorefrontShellProps) {
  return (
    <div
      data-app-shell="storefront"
      className="
        flex min-h-dvh flex-col bg-[var(--sf-color-canvas)]
        text-[var(--sf-color-ink)]
      "
    >
      <a href="#main-content" className="sf-skip-link">
        رفتن به محتوای اصلی
      </a>
      <StorefrontHeader />
      <div className="flex-1">{children}</div>
      <StorefrontFooter content={footerContent} />
    </div>
  );
}
