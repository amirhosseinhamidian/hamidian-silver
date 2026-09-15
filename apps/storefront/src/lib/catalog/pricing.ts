export function getDiscountPercent(
  compareAtPriceToman: number | null | undefined,
  salePriceToman: number | null | undefined,
): number | null {
  if (
    typeof compareAtPriceToman !== 'number' ||
    !Number.isSafeInteger(compareAtPriceToman) ||
    compareAtPriceToman <= 0 ||
    typeof salePriceToman !== 'number' ||
    !Number.isSafeInteger(salePriceToman) ||
    salePriceToman < 0 ||
    compareAtPriceToman <= salePriceToman
  ) {
    return null;
  }

  return Math.round(((salePriceToman - compareAtPriceToman) / compareAtPriceToman) * -100);
}

export function getPriceDiscount(
  compareAtPriceToman: number | null | undefined,
  salePriceToman: number | null | undefined,
) {
  const discountPercent = getDiscountPercent(compareAtPriceToman, salePriceToman);

  return {
    hasDiscount: discountPercent !== null,
    discountPercent,
  };
}
