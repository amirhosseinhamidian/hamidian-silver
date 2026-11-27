import { allocateCheckoutToman, returnedLineCredit } from './wallet-checkout';

describe('checkout wallet allocation', () => {
  it('preserves the exact total and leaves ineligible merchandise untouched', () => {
    expect(allocateCheckoutToman(5, [4, 0, 4])).toEqual([2, 0, 3]);
    expect(allocateCheckoutToman(2_147_483_646, [2_147_483_646, 1])).toEqual([2_147_483_645, 1]);
  });

  it('returns the rounding remainder on the final unit without refunding it twice', () => {
    expect(returnedLineCredit(11, 3, 0, 1)).toBe(3);
    expect(returnedLineCredit(11, 3, 1, 1)).toBe(4);
    expect(returnedLineCredit(11, 3, 2, 1)).toBe(4);
    expect(returnedLineCredit(11, 3, 0, 3)).toBe(11);
  });
});
