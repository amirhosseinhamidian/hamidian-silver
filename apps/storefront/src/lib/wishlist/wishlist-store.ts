'use client';

import { useSyncExternalStore } from 'react';

import {
  deserializeWishlist,
  isWishlistItem,
  serializeWishlist,
  toggleWishlistItem,
  type WishlistItem,
} from '@/lib/wishlist/wishlist-state';

const WISHLIST_STORAGE_KEY = 'hamidian-storefront-wishlist-v1';
const EMPTY_WISHLIST: readonly WishlistItem[] = [];

let wishlistItems: readonly WishlistItem[] = EMPTY_WISHLIST;
let initialized = false;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function initializeWishlistStore() {
  if (initialized || typeof window === 'undefined') {
    return;
  }

  initialized = true;

  try {
    wishlistItems = deserializeWishlist(window.localStorage.getItem(WISHLIST_STORAGE_KEY));
  } catch {
    wishlistItems = EMPTY_WISHLIST;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== WISHLIST_STORAGE_KEY) {
      return;
    }

    wishlistItems = deserializeWishlist(event.newValue);
    emitChange();
  });
}

function persistWishlist(nextItems: readonly WishlistItem[]) {
  wishlistItems = nextItems;

  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, serializeWishlist(nextItems));
  } catch {
    // Keep wishlist interactions usable when browser storage is unavailable.
  }

  emitChange();
}

function subscribe(listener: () => void) {
  initializeWishlistStore();
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function getSnapshot() {
  return wishlistItems;
}

function getServerSnapshot() {
  return EMPTY_WISHLIST;
}

export function useWishlist() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    items,
    hasItem: (productId: string) => isWishlistItem(items, productId),
    toggleItem: (item: WishlistItem) => {
      initializeWishlistStore();
      persistWishlist(toggleWishlistItem(wishlistItems, item));
    },
  };
}
