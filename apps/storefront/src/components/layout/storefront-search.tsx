'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { FiSearch, FiX } from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';

export function StorefrontSearch() {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="جستجو در محصولات"
          className="
            inline-flex size-9 items-center justify-center
            transition-opacity duration-150 hover:opacity-55
          "
        >
          <FiSearch aria-hidden="true" size={22} />
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
            fixed inset-x-0 top-0 z-[100]
            border-b border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)]
            px-5 py-6 shadow-sm sm:px-8 sm:py-8
            data-[state=closed]:animate-[sf-overlay-close_300ms_ease-in_forwards]
            data-[state=open]:animate-[sf-overlay-open_360ms_ease-out]
          "
        >
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between gap-4">
              <DialogPrimitive.Title className="text-lg font-medium sm:text-xl">
                جستجو در محصولات
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="بستن جستجو"
                className="
                  inline-flex size-10 items-center justify-center
                  rounded-[var(--sf-radius-md)] border border-[var(--sf-color-border)]
                  transition-colors hover:border-[var(--sf-color-ink)]
                "
              >
                <FiX aria-hidden="true" size={21} />
              </DialogPrimitive.Close>
            </div>

            <DialogPrimitive.Description className="mt-2 text-xs text-[var(--sf-color-muted)]">
              نام محصول موردنظر خود را وارد کنید.
            </DialogPrimitive.Description>

            <form action="/products" method="get" role="search" className="mt-5 flex gap-2">
              <label htmlFor="storefront-product-search" className="sr-only">
                نام محصول
              </label>
              <Input
                id="storefront-product-search"
                type="search"
                name="q"
                maxLength={100}
                placeholder="مثلاً انگشتر نقره"
                autoComplete="off"
                className="min-w-0 flex-1"
              />
              <Button type="submit" aria-label="اجرای جستجو">
                <FiSearch aria-hidden="true" size={18} />
                <span className="hidden sm:inline">جستجو</span>
              </Button>
            </form>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
