import { allocateWalletAmount, returnedWalletBucket } from './wallet-ledger';

describe('wallet movement helpers', () => {
  it('allocates across ordered lots and refuses a partially funded request', () => {
    const first = { id: 'first', capacity: 40 };
    const second = { id: 'second', capacity: 60 };
    expect(allocateWalletAmount([first, second], 75)).toEqual([
      { source: first, amount: 40 },
      { source: second, amount: 35 },
    ]);
    expect(allocateWalletAmount([first, second], 101)).toBeNull();
  });

  it('returns captured or reserved credit to expiry at the original deadline', () => {
    const expiry = new Date('2026-11-22T11:30:00.000Z');
    expect(returnedWalletBucket(new Date(+expiry - 1), expiry)).toBe('AVAILABLE');
    expect(returnedWalletBucket(expiry, expiry)).toBe('EXPIRED');
    expect(returnedWalletBucket(new Date(+expiry + 1), expiry)).toBe('EXPIRED');
  });
});
