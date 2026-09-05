'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertCircle } from 'react-icons/fi';

import { DiscountBadge } from '@/components/catalog/discount-badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { QuantityControl } from '@/components/ui/quantity-control';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { getDiscountPercent } from '@/lib/catalog/pricing';
import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';
import { cartItemKey, type CartPlatingType } from '@/lib/cart/cart-state';
import { useCart } from '@/lib/cart/cart-store';

const persianNumber = new Intl.NumberFormat('fa-IR');

const platingLabels: Record<CartPlatingType, string> = {
  GOLD: 'آبکاری طلا',
  RHODIUM: 'آبکاری رودیوم',
};

type ProductVariant = PublicCatalogProductDetail['variants'][number];

function getVariantOptionLabel(variant: ProductVariant): string {
  return variant.size?.label?.trim() || variant.name?.trim() || 'بدون سایز';
}

function getCartVariantLabel(variant: ProductVariant): string {
  const sizeLabel = variant.size?.label?.trim();

  if (sizeLabel) {
    return `سایز: ${sizeLabel}`;
  }

  const modelName = variant.name?.trim();

  return modelName ? `مدل: ${modelName}` : 'بدون سایز';
}

type ProductPurchasePanelProps = Readonly<{
  product: PublicCatalogProductDetail;
}>;

export function ProductPurchasePanel({ product }: ProductPurchasePanelProps) {
  const initiallySelectedVariant =
    product.variants.length === 1 && product.variants[0]?.isAvailable ? product.variants[0].id : '';
  const [variantId, setVariantId] = useState(initiallySelectedVariant);
  const [platingType, setPlatingType] = useState<CartPlatingType | null>(null);
  const [variantMessage, setVariantMessage] = useState<string | null>(null);
  const [selectionToast, setSelectionToast] = useState<string | null>(null);
  const variantSelectorRef = useRef<HTMLFieldSetElement>(null);
  const { items, addItem, setQuantity, removeItem } = useCart();

  useEffect(() => {
    if (!selectionToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setSelectionToast(null), 2600);

    return () => window.clearTimeout(timeoutId);
  }, [selectionToast]);

  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.id === variantId) ?? null,
    [product.variants, variantId],
  );
  const selectedPlating = selectedVariant?.platingOptions.find(
    (option) => option.type === platingType,
  );
  const selectedCartItem = selectedVariant
    ? (items.find((item) => item.key === cartItemKey(selectedVariant.id, platingType)) ?? null)
    : null;
  const maxQuantity = selectedVariant
    ? Math.max(1, Math.min(99, selectedVariant.availableQuantity))
    : 1;
  const unitPriceToman =
    product.salePriceToman === null
      ? null
      : product.salePriceToman + (selectedPlating?.unitPriceToman ?? 0);
  const discountPercent = getDiscountPercent(
    product.compareAtPriceToman,
    product.salePriceToman,
  );
  const canAdd =
    selectedVariant?.isAvailable === true &&
    selectedVariant.availableQuantity > 0 &&
    product.salePriceToman !== null;
  const hasMultipleVariants = product.variants.length > 1;
  const isSizeSelection = product.sizeMode === 'SIZED';
  const selectorLabel = isSizeSelection ? 'انتخاب سایز' : 'انتخاب مدل';
  const hasPurchasableVariant = product.variants.some(
    (variant) => variant.isAvailable && variant.availableQuantity > 0,
  );
  const desktopAddButtonDisabled = !canAdd;
  const mobileAddButtonDisabled =
    product.salePriceToman === null ||
    !hasPurchasableVariant ||
    (selectedVariant !== null && !canAdd);

  function selectVariant(nextVariantId: string) {
    setVariantId(nextVariantId);
    setPlatingType(null);
    setVariantMessage(null);
    setSelectionToast(null);
  }

  function selectPlating(nextPlatingType: CartPlatingType | null) {
    setPlatingType(nextPlatingType);
  }

  function requestVariantSelection(): boolean {
    if (selectedVariant) {
      return true;
    }

    if (hasMultipleVariants) {
      const message = isSizeSelection ? 'لطفاً سایز را انتخاب کنید.' : 'لطفاً مدل را انتخاب کنید.';
      setVariantMessage(message);
      setSelectionToast(message);
      variantSelectorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }

    return false;
  }

  function handleAddToCart() {
    if (
      !requestVariantSelection() ||
      !selectedVariant ||
      !canAdd ||
      product.salePriceToman === null
    ) {
      return;
    }

    addItem({
      variantId: selectedVariant.id,
      productSlug: product.slug,
      productName: product.name,
      variantLabel: getCartVariantLabel(selectedVariant),
      media: product.primaryMedia,
      unitSalePriceToman: product.salePriceToman,
      unitCompareAtPriceToman: product.compareAtPriceToman ?? null,
      platingType,
      unitPlatingPriceToman: selectedPlating?.unitPriceToman ?? 0,
      platingLeadTimeDays: selectedPlating?.leadTimeDays ?? 0,
      quantity: 1,
      maxQuantity,
    });
  }

  return (
    <section
      aria-labelledby="purchase-options-title"
      className="mt-9 border-t border-[var(--sf-color-border)] pt-7"
    >
      <h2 id="purchase-options-title" className="text-sm font-medium">
        انتخاب و خرید
      </h2>

      {hasMultipleVariants ? (
        <fieldset ref={variantSelectorRef} className="mt-5 scroll-mt-28">
          <legend className="sr-only">{selectorLabel}</legend>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-[var(--sf-color-muted)]">{selectorLabel}</span>
            {isSizeSelection ? (
              <Link
                href="/size-guide"
                className="border-b border-[var(--sf-color-border-strong)] text-xs"
              >
                راهنمای انتخاب سایز
              </Link>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <label key={variant.id} className="cursor-pointer">
                <input
                  type="radio"
                  name={`variant-${product.id}`}
                  value={variant.id}
                  checked={variantId === variant.id}
                  disabled={!variant.isAvailable}
                  onChange={() => selectVariant(variant.id)}
                  className="peer sr-only"
                />
                <span
                  className="
                    inline-flex min-h-11 min-w-12 items-center justify-center
                    border border-[var(--sf-color-border)] px-4 py-2 text-sm
                    transition-colors peer-checked:border-[var(--sf-color-ink)]
                    peer-checked:bg-[var(--sf-color-ink)] peer-checked:text-white
                    peer-disabled:cursor-not-allowed peer-disabled:opacity-35
                  "
                >
                  {getVariantOptionLabel(variant)}
                </span>
              </label>
            ))}
          </div>
          {variantMessage ? (
            <p
              role="alert"
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600"
            >
              <FiAlertCircle aria-hidden="true" className="shrink-0" size={15} />
              <span>{variantMessage}</span>
            </p>
          ) : null}
        </fieldset>
      ) : product.variants.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--sf-color-muted)]">
          این محصول در حال حاضر گزینه قابل خریدی ندارد.
        </p>
      ) : null}

      {selectedVariant && selectedVariant.platingOptions.length > 0 ? (
        <fieldset className="mt-6">
          <legend className="text-xs text-[var(--sf-color-muted)]">نوع آبکاری</legend>
          <div className="mt-3 grid gap-2">
            <label className="cursor-pointer">
              <input
                type="radio"
                name={`plating-${product.id}`}
                checked={platingType === null}
                onChange={() => selectPlating(null)}
                className="peer sr-only"
              />
              <span
                className="
                  flex min-h-12 items-center justify-between gap-3
                  border border-[var(--sf-color-border)] px-3 py-2 text-sm
                  transition-colors peer-checked:border-[var(--sf-color-ink)]
                "
              >
                <span>بدون آبکاری</span>
                <span className="text-xs text-[var(--sf-color-muted)]">بدون هزینه اضافه</span>
              </span>
            </label>

            {selectedVariant.platingOptions.map((option) => (
              <label key={option.type} className="cursor-pointer">
                <input
                  type="radio"
                  name={`plating-${product.id}`}
                  checked={platingType === option.type}
                  onChange={() => selectPlating(option.type)}
                  className="peer sr-only"
                />
                <span
                  className="
                    flex min-h-12 items-center justify-between gap-3
                    border border-[var(--sf-color-border)] px-3 py-2 text-sm
                    transition-colors peer-checked:border-[var(--sf-color-ink)]
                  "
                >
                  <span>{platingLabels[option.type]}</span>
                  <span className="text-left text-xs leading-5 text-[var(--sf-color-muted)]">
                    + {formatTomanPrice(option.unitPriceToman)}
                    {option.leadTimeDays > 0 ? (
                      <>
                        <br />
                        {persianNumber.format(option.leadTimeDays)} روز زمان آماده‌سازی
                      </>
                    ) : null}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {selectedVariant ? (
        <div className="mt-6 hidden flex-wrap items-end justify-between gap-5 lg:flex">
          {selectedCartItem ? (
            <div>
              <p className="text-xs text-[var(--sf-color-muted)]">تعداد</p>
              <div className="mt-2">
                <QuantityControl
                  value={selectedCartItem.quantity}
                  max={selectedCartItem.maxQuantity}
                  onChange={(nextQuantity) =>
                    setQuantity(selectedCartItem.key, nextQuantity)
                  }
                  onRemove={() => removeItem(selectedCartItem.key)}
                />
              </div>
            </div>
          ) : null}

          <div className="text-left">
            <p className="text-xs text-[var(--sf-color-muted)]">قیمت هر واحد با انتخاب فعلی</p>
            {discountPercent !== null ? (
              <div className="mt-2 flex items-center justify-end gap-2 text-xs text-[var(--sf-color-muted)]">
                <span className="line-through">
                  {formatTomanPrice(product.compareAtPriceToman)}
                </span>
                <DiscountBadge percent={discountPercent} />
              </div>
            ) : null}
            <p className={discountPercent !== null ? 'mt-1 text-lg' : 'mt-2 text-lg'}>
              {formatTomanPrice(unitPriceToman)}
            </p>
          </div>
        </div>
      ) : hasMultipleVariants ? (
        <p className="mt-6 hidden text-sm text-[var(--sf-color-muted)] lg:block">
          {isSizeSelection ? 'برای ادامه سایز را انتخاب کنید.' : 'برای ادامه مدل را انتخاب کنید.'}
        </p>
      ) : null}

      {selectedCartItem ? (
        <ButtonLink
          href="/cart"
          variant="solid"
          size="lg"
          className="mt-6 hidden w-full lg:inline-flex"
        >
          مشاهده سبد خرید
        </ButtonLink>
      ) : (
        <Button
          type="button"
          size="lg"
          className="mt-6 hidden w-full lg:inline-flex"
          disabled={desktopAddButtonDisabled}
          onClick={handleAddToCart}
        >
          افزودن به سبد خرید
        </Button>
      )}

      {product.salePriceToman === null ? (
        <p className="mt-3 text-xs leading-6 text-[var(--sf-color-muted)]">
          این محصول تا زمان تعیین قیمت قابل افزودن به سبد خرید نیست.
        </p>
      ) : null}

      {selectionToast ? (
        <div
          aria-live="polite"
          className="
            fixed inset-x-4 bottom-28 z-50 mx-auto flex max-w-sm items-center gap-2
            border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-700
            shadow-[0_10px_30px_rgba(0,0,0,0.12)] lg:hidden
          "
        >
          <FiAlertCircle aria-hidden="true" className="shrink-0" size={18} />
          <span>{selectionToast}</span>
        </div>
      ) : null}

      <div
        className="
          fixed inset-x-0 bottom-0 z-40 box-border w-full max-w-[100dvw]
          overflow-x-clip border-t border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)]
          px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3
          shadow-[0_-10px_30px_rgba(0,0,0,0.06)] lg:hidden
        "
      >
        <div className="mx-auto w-full min-w-0 max-w-xl">
          {discountPercent !== null ? (
            <div className="flex items-center justify-end gap-2 text-xs text-[var(--sf-color-muted)]">
              <span className="line-through">
                {formatTomanPrice(product.compareAtPriceToman)}
              </span>
              <DiscountBadge percent={discountPercent} />
            </div>
          ) : null}
          <p
            className={
              discountPercent !== null
                ? 'mt-1 text-right text-xl font-semibold leading-none sm:text-2xl'
                : 'text-right text-xl font-semibold leading-none sm:text-2xl'
            }
          >
            {formatTomanPrice(unitPriceToman)}
          </p>

          <div
            className={
              selectedCartItem
                ? 'mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3'
                : 'mt-3 grid min-w-0'
            }
          >
            {selectedCartItem ? (
              <QuantityControl
                value={selectedCartItem.quantity}
                max={selectedCartItem.maxQuantity}
                compact
                onChange={(nextQuantity) => setQuantity(selectedCartItem.key, nextQuantity)}
                onRemove={() => removeItem(selectedCartItem.key)}
              />
            ) : null}
            {selectedCartItem ? (
              <ButtonLink
                href="/cart"
                variant="solid"
                size="lg"
                className="min-w-0 w-full px-3 sm:px-7"
              >
                مشاهده سبد خرید
              </ButtonLink>
            ) : (
              <Button
                type="button"
                size="lg"
                className="min-w-0 w-full px-3 sm:px-7"
                disabled={mobileAddButtonDisabled}
                onClick={handleAddToCart}
              >
                افزودن به سبد خرید
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
