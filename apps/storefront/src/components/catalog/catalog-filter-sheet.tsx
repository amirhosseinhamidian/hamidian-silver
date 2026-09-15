'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { FiSliders, FiX } from 'react-icons/fi';

import { buttonClassName } from '@/components/ui/button';

type CatalogFilterSheetProps = Readonly<{
  children: ReactNode;
  activeCount: number;
}>;

const persianNumber = new Intl.NumberFormat('fa-IR');

export function CatalogFilterSheet({ children, activeCount }: CatalogFilterSheetProps) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <button type="button" className={buttonClassName({ variant: 'outline', size: 'md' })}>
          <FiSliders aria-hidden="true" size={16} />
          فیلتر
          {activeCount > 0 ? (
            <span className="text-xs text-[var(--sf-color-muted)]">
              ({persianNumber.format(activeCount)})
            </span>
          ) : null}
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
          className="
            fixed inset-x-0 bottom-0 z-[100] flex max-h-[88dvh] flex-col
            rounded-t-[var(--sf-radius-md)] bg-[var(--sf-color-canvas)]
            data-[state=closed]:animate-[sf-sheet-close_560ms_cubic-bezier(0.16,1,0.3,1)_forwards]
            data-[state=open]:animate-[sf-sheet-open_640ms_cubic-bezier(0.16,1,0.3,1)]
          "
        >
          <div
            className="
              sticky top-0 z-10 flex items-center justify-between gap-4
              border-b border-[var(--sf-color-border)]
              bg-[var(--sf-color-canvas)] px-5 py-4
            "
          >
            <DialogPrimitive.Title className="text-lg font-medium">
              فیلتر محصولات
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="بستن فیلترها"
              className="
                inline-flex size-10 items-center justify-center
                rounded-[var(--sf-radius-md)] border border-[var(--sf-color-border)]
              "
            >
              <FiX aria-hidden="true" size={21} />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className="sr-only">
            فیلترهای جستجو، دسته‌بندی و برند محصولات.
          </DialogPrimitive.Description>

          <div className="px-5 pb-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
