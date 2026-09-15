'use client';

import { useSyncExternalStore } from 'react';

import {
  addCartItem,
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
const EMPTY_CART: readonly CartItem[] = [];

let cartItems: readonly CartItem[] = EMPTY_CART;
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
  } catch {
    cartItems = EMPTY_CART;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== CART_STORAGE_KEY) {
      return;
    }

    cartItems = deserializeCart(event.newValue);
    emitChange();
  });
}

function persistCart(nextItems: readonly CartItem[]) {
  cartItems = nextItems;

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(nextItems));
  } catch {
    // Keep the in-memory cart usable when storage is blocked or full.
  }

  emitChange();
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
  persistCart(addCartItem(cartItems, input));
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

  return {
    items,
    itemCount: getCartItemCount(items),
    subtotalToman: getCartSubtotalToman(items),
    addItem,
    setQuantity,
    removeItem,
    clearCart,
  };
}
