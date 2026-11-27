export const TOMAN_INT_MAX = 2_147_483_647;
export const TOMAN_INT_MIN = -2_147_483_648;
// A wallet-assisted checkout must still be payable via the supported online gateways.
export const MIN_WALLET_CASH_PAYMENT_TOMAN = 10_000;

export function isNonNegativeTomanInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= TOMAN_INT_MAX;
}

export function isSignedTomanInt(value: number): boolean {
  return Number.isInteger(value) && value >= TOMAN_INT_MIN && value <= TOMAN_INT_MAX;
}
