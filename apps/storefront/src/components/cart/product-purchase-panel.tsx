'use client';

import { useMemo, useState } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { QuantityControl } from '@/components/ui/quantity-control';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';
import type { CartPlatingType } from '@/lib/cart/cart-state';
import { useCart } from '@/lib/cart/cart-store';

const persianNumber = new Intl.NumberFormat('fa-IR');

const platingLabels: Record<CartPlatingType, string> = {
  GOLD: 'آبکاری طلا',
  RHODIUM: 'آبکاری رودیوم',
};

type ProductVariant = PublicCatalogProductDetail['variants'][number];

function getVariantLabel(variant: ProductVariant): string {
  return variant.size?.label?.trim() || variant.name?.trim() || 'بدون سایز';
}

type ProductPurchasePanelProps = Readonly<{
  product: PublicCatalogProductDetail;
}>;

export function ProductPurchasePanel({ product }: ProductPurchasePanelProps) {
  const initiallySelectedVariant =
    product.variants.length === 1 && product.variants[0]?.isAvailable
      ? product.variants[0].id
      : '';
  const [variantId, setVariantId] = useState(initiallySelectedVariant);
  const [platingType, setPlatingType] = useState<CartPlatingType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.id === variantId) ?? null,
    [product.variants, variantId],
  );
  const selectedPlating = selectedVariant?.platingOptions.find(
    (option) => option.type === platingType,
  );
  const maxQuantity = selectedVariant
    ? Math.max(1, Math.min(99, selectedVariant.availableQuantity))
    : 1;
  const unitPriceToman =
    product.salePriceToman === null
      ? null
      : product.salePriceToman + (selectedPlating?.unitPriceToman ?? 0);
  const canAdd =
    selectedVariant?.isAvailable === true &&
    selectedVariant.availableQuantity > 0 &&
    product.salePriceToman !== null;

  function selectVariant(nextVariantId: string) {
    setVariantId(nextVariantId);
    setPlatingType(null);
    setQuantity(1);
    setAdded(false);
  }

  function selectPlating(nextPlatingType: CartPlatingType | null) {
    setPlatingType(nextPlatingType);
    setAdded(false);
  }

  function handleAddToCart() {
    if (!selectedVariant || !canAdd || product.salePriceToman === null) {
      return;
    }

    addItem({
      variantId: selectedVariant.id,
      productSlug: product.slug,
      productName: product.name,
      variantLabel: getVariantLabel(selectedVariant),
      media: product.primaryMedia,
      unitSalePriceToman: product.salePriceToman,
      platingType,
      unitPlatingPriceToman: selectedPlating?.unitPriceToman ?? 0,
      platingLeadTimeDays: selectedPlating?.leadTimeDays ?? 0,
      quantity,
      maxQuantity,
    });
    setAdded(true);
  }

  return (
    <section
      aria-labelledby="purchase-options-title"
      className="mt-10 border-t border-[var(--sf-color-border)] pt-8"
    >
      <h2 id="purchase-options-title" className="text-sm font-medium">
        انتخاب و خرید
      </h2>

      {product.variants.length > 0 ? (
        <fieldset className="mt-5">
          <legend className="text-xs text-[var(--sf-color-muted)]">گزینه محصول</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                    flex min-h-12 items-center justify-between gap-3
                    border border-[var(--sf-color-border)] px-3 py-2 text-sm
                    transition-colors peer-checked:border-[var(--sf-color-ink)]
                    peer-disabled:cursor-not-allowed peer-disabled:opacity-45
                  "
                >
                  <span>{getVariantLabel(variant)}</span>
                  <span className="text-xs text-[var(--sf-color-muted)]">
                    {variant.isAvailable
                      ? `${persianNumber.format(variant.availableQuantity)} موجود`
                      : 'ناموجود'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="mt-5 text-sm text-[var(--sf-color-muted)]">
          گزینه قابل خریدی برای این محصول تعریف نشده است.
        </p>
      )}

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
        <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs text-[var(--sf-color-muted)]">تعداد</p>
            <div className="mt-2">
              <QuantityControl
                value={quantity}
                max={maxQuantity}
                disabled={!canAdd}
                onChange={(nextQuantity) => {
                  setQuantity(nextQuantity);
                  setAdded(false);
                }}
              />
            </div>
          </div>

          <div className="text-left">
            <p className="text-xs text-[var(--sf-color-muted)]">قیمت هر واحد با انتخاب فعلی</p>
            <p className="mt-2 text-lg">{formatTomanPrice(unitPriceToman)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-[var(--sf-color-muted)]">
          برای ادامه یک گزینه موجود را انتخاب کنید.
        </p>
      )}

      <Button
        type="button"
        size="lg"
        className="mt-6 w-full"
        disabled={!canAdd}
        onClick={handleAddToCart}
      >
        افزودن به سبد خرید
      </Button>

      {product.salePriceToman === null ? (
        <p className="mt-3 text-xs leading-6 text-[var(--sf-color-muted)]">
          این محصول تا زمان تعیین قیمت قابل افزودن به سبد خرید نیست.
        </p>
      ) : null}

      {added ? (
        <div
          role="status"
          className="
            mt-4 flex flex-wrap items-center justify-between gap-3
            border border-[var(--sf-color-border)] px-4 py-3 text-sm
          "
        >
          <span>محصول به سبد خرید اضافه شد.</span>
          <ButtonLink href="/cart" variant="text" size="sm">
            مشاهده سبد خرید
          </ButtonLink>
        </div>
      ) : null}
    </section>
  );
}
