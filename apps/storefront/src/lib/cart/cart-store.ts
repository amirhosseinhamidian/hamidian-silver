'use client';

import { useSyncExternalStore } from 'react';
import { AUTHENTICATION_ENDED_EVENT } from '@/lib/auth/events';
import type { SavedCartVersion } from './cart-recovery';

import {
  addCartItem,
  cartItemKey,
  deserializeCart,
  getCartItemCount,
  getCartSubtotalToman,
  removeCartItem,
  serializeCart,
  setCartItemQuantity,
  type AddCartItemInput,
  type CartItem,
} from '@/lib/cart/cart-state';

const CART_STORAGE_KEY = 'hamidian-storefront-cart-v1';
const RECOVERY_STORAGE_KEY = 'hamidian-storefront-recovered-cart-v1';
const EMPTY_CART: readonly CartItem[] = [];

let cartItems: readonly CartItem[] = EMPTY_CART;
let recoveredCartVersion: SavedCartVersion | null = null;
let initialized = false;

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function initializeCartStore() {
  if (initialized || typeof window === 'undefined') {
    return;
  }

  initialized = true;

  try {
    cartItems = deserializeCart(window.localStorage.getItem(CART_STORAGE_KEY));
    recoveredCartVersion = readRecoveredCartVersion();
  } catch {
    cartItems = EMPTY_CART;
  }

  window.addEventListener('storage', (event) => {
    if (event.key === CART_STORAGE_KEY) cartItems = deserializeCart(event.newValue);
    else if (event.key !== RECOVERY_STORAGE_KEY) return;
    recoveredCartVersion = readRecoveredCartVersion();
    emitChange();
  });
  window.addEventListener(AUTHENTICATION_ENDED_EVENT, () => {
    if (recoveredCartVersion) clearCart();
  });
}

function persistCart(nextItems: readonly CartItem[]) {
  cartItems = nextItems;
  if (!nextItems.length) recoveredCartVersion = null;

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(nextItems));
    if (!nextItems.length) window.localStorage.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    // Keep the in-memory cart usable when storage is blocked or full.
  }

  emitChange();
}

function readRecoveredCartVersion(): SavedCartVersion | null {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(RECOVERY_STORAGE_KEY) ?? 'null',
    ) as SavedCartVersion | null;
    return value &&
      typeof value.cartId === 'string' &&
      Number.isSafeInteger(value.revision) &&
      value.revision > 0
      ? value
      : null;
  } catch {
    return null;
  }
}

export function restoreCart(items: readonly AddCartItemInput[], version: SavedCartVersion) {
  initializeCartStore();
  recoveredCartVersion = version;
  try {
    window.localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(version));
  } catch {
    // The current tab can still continue with the restored products.
  }
  persistCart(items.reduce<readonly CartItem[]>((result, item) => addCartItem(result, item), []));
}

function subscribe(listener: () => void) {
  initializeCartStore();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return cartItems;
}

function getServerSnapshot() {
  return EMPTY_CART;
}

function addItem(input: AddCartItemInput) {
  initializeCartStore();
  const key = cartItemKey(input.variantId, input.platingType);
  const before = cartItems.find((item) => item.key === key)?.quantity ?? 0;
  const next = addCartItem(cartItems, input);
  const after = next.find((item) => item.key === key)?.quantity ?? 0;
  persistCart(next);
  return Math.max(0, after - before);
}

function setQuantity(key: string, quantity: number) {
  initializeCartStore();
  persistCart(setCartItemQuantity(cartItems, key, quantity));
}

function removeItem(key: string) {
  initializeCartStore();
  persistCart(removeCartItem(cartItems, key));
}

function clearCart() {
  initializeCartStore();
  persistCart(EMPTY_CART);
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const recoveredCart = useSyncExternalStore(
    subscribe,
    () => recoveredCartVersion,
    () => null,
  );

  return {
    items,
    recoveredCart,
    itemCount: getCartItemCount(items),
    subtotalToman: getCartSubtotalToman(items),
    addItem,
    setQuantity,
    removeItem,
    clearCart,
  };
}
