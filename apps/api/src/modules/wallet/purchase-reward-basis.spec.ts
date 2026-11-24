import { purchaseRewardLines } from './purchase-reward-basis';

const lines = [
  {
    productId: 'A',
    categoryIds: [],
    quantity: 2,
    returnedQuantity: 1,
    unitSalePriceToman: 20_000,
    directDiscountToman: 2_000,
    walletAppliedToman: 8_000,
  },
  {
    productId: 'B',
    categoryIds: [],
    quantity: 1,
    returnedQuantity: 0,
    unitSalePriceToman: 15_000,
    directDiscountToman: 0,
    walletAppliedToman: 0,
  },
];

describe('purchase reward basis', () => {
  it('deducts the cash share of a physical return and applies only additional cash refunds', () => {
    expect(purchaseRewardLines(lines, 15_000).map((line) => line.refundedCashToman)).toEqual([
      15_000, 0,
    ]);
    expect(purchaseRewardLines(lines, 19_000).map((line) => line.refundedCashToman)).toEqual([
      17_000, 2_000,
    ]);
  });

  it('does not deduct more cash than the merchandise originally received', () => {
    expect(purchaseRewardLines(lines, 100_000).map((line) => line.refundedCashToman)).toEqual([
      30_000, 15_000,
    ]);
  });
});
