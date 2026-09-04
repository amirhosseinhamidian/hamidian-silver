import { describe, expect, it } from 'vitest';

import { formatTomanPrice } from '@/lib/catalog/presentation';

describe('formatTomanPrice', () => {
  it('keeps Persian digits while using baseline commas for grouping', () => {
    expect(formatTomanPrice(3_950_000)).toBe('۳,۹۵۰,۰۰۰ تومان');
  });

  it('preserves the contact-for-price fallback', () => {
    expect(formatTomanPrice(null)).toBe('برای اطلاع از قیمت تماس بگیرید');
  });
});
