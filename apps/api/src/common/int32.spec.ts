import { INT32_MAX, INT32_MIN, isNonNegativeInt32, isSignedInt32 } from './int32';

describe('PostgreSQL Int32 contract', () => {
  it('accepts only non-negative values storable in PostgreSQL Int', () => {
    expect(isNonNegativeInt32(0)).toBe(true);
    expect(isNonNegativeInt32(INT32_MAX)).toBe(true);
    expect(isNonNegativeInt32(INT32_MAX + 1)).toBe(false);
    expect(isNonNegativeInt32(-1)).toBe(false);
  });

  it('accepts the full signed PostgreSQL Int range', () => {
    expect(isSignedInt32(INT32_MIN)).toBe(true);
    expect(isSignedInt32(INT32_MAX)).toBe(true);
    expect(isSignedInt32(INT32_MIN - 1)).toBe(false);
    expect(isSignedInt32(INT32_MAX + 1)).toBe(false);
    expect(isSignedInt32(1.5)).toBe(false);
  });
});
