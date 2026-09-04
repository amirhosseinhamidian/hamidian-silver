'use client';

import Link from 'next/link';
import { FiShoppingBag } from 'react-icons/fi';

import { useCart } from '@/lib/cart/cart-store';

const persianNumber = new Intl.NumberFormat('fa-IR');

export function CartHeaderLink() {
  const { itemCount } = useCart();
  const badge = itemCount > 99 ? '۹۹+' : persianNumber.format(itemCount);
  const label =
    itemCount > 0 ? `سبد خرید، ${persianNumber.format(itemCount)} کالا` : 'سبد خرید';

  return (
    <Link
      href="/cart"
      aria-label={label}
      className="
        relative inline-flex size-9 items-center justify-center
        transition-opacity duration-150 hover:opacity-55
      "
    >
      <FiShoppingBag aria-hidden="true" size={21} />
      {itemCount > 0 ? (
        <span
          aria-hidden="true"
          className="
            absolute -start-1 -top-1 inline-flex min-h-4 min-w-4 items-center
            justify-center rounded-full bg-[var(--sf-color-ink)] px-1 text-[0.6rem]
            leading-none text-[var(--sf-color-inverse)]
          "
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
