'use client';

import type { components } from '@hamidian/contracts';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type PublicPromotions = components['schemas']['PublicPromotionsDto'];
const PromotionContext = createContext<PublicPromotions>({ available: false, items: [] });

export function PromotionProvider({
  promotions,
  children,
}: {
  promotions: PublicPromotions;
  children: ReactNode;
}) {
  const [asOf, setAsOf] = useState(0);
  const items = promotions.items.filter((item) => Date.parse(item.endsAt) > asOf);
  const nextExpiry = items.reduce(
    (first, item) => Math.min(first, Date.parse(item.endsAt)),
    Infinity,
  );
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return;
    const timer = window.setTimeout(
      () => setAsOf(Date.now()),
      Math.min(2_147_483_647, Math.max(0, nextExpiry - Date.now())),
    );
    return () => window.clearTimeout(timer);
  }, [nextExpiry, asOf]);

  return (
    <PromotionContext.Provider value={{ available: promotions.available, items }}>
      {children}
    </PromotionContext.Provider>
  );
}

export function usePromotions() {
  return useContext(PromotionContext);
}

export function ProductPromotion({
  id,
  categories,
}: {
  id: string;
  categories: readonly { id: string }[];
}) {
  const { items } = usePromotions();
  const offer = items.find(
    (item) =>
      item.allProducts ||
      item.productIds.includes(id) ||
      categories.some((category) => item.categoryIds.includes(category.id)),
  );
  return offer ? (
    <p className="text-xs text-[var(--sf-color-muted)]">
      {offer.name} ·{' '}
      {offer.kind === 'FREE_SHIPPING' ? 'ارسال رایگان با شرایط کمپین' : 'تخفیف با شرایط سبد'}
    </p>
  ) : null;
}
