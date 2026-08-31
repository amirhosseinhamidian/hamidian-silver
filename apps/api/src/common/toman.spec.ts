import { isNonNegativeTomanInt, isSignedTomanInt, TOMAN_INT_MAX, TOMAN_INT_MIN } from './toman';

describe('Toman PostgreSQL Int contract', () => {
  it('accepts the full non-negative PostgreSQL Int range', () => {
    expect(isNonNegativeTomanInt(0)).toBe(true);
    expect(isNonNegativeTomanInt(TOMAN_INT_MAX)).toBe(true);
    expect(isNonNegativeTomanInt(TOMAN_INT_MAX + 1)).toBe(false);
    expect(isNonNegativeTomanInt(-1)).toBe(false);
  });

  it('accepts signed values only inside the PostgreSQL Int range', () => {
    expect(isSignedTomanInt(TOMAN_INT_MIN)).toBe(true);
    expect(isSignedTomanInt(TOMAN_INT_MAX)).toBe(true);
    expect(isSignedTomanInt(TOMAN_INT_MIN - 1)).toBe(false);
    expect(isSignedTomanInt(TOMAN_INT_MAX + 1)).toBe(false);
    expect(isSignedTomanInt(1.5)).toBe(false);
  });
});
