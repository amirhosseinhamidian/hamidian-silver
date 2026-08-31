export const INT32_MAX = 2_147_483_647;
export const INT32_MIN = -2_147_483_648;

export function isNonNegativeInt32(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= INT32_MAX;
}

export function isSignedInt32(value: number): boolean {
  return Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX;
}
