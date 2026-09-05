export function getDiscountPercent(
  compareAtPriceToman: number | null,
  salePriceToman: number | null,
): number | null {
  if (
    compareAtPriceToman === null ||
    salePriceToman === null ||
    compareAtPriceToman <= salePriceToman
  ) {
    return null;
  }

  return Math.round(((salePriceToman - compareAtPriceToman) / compareAtPriceToman) * -100);
}

export function getPriceDiscount(
  compareAtPriceToman: number | null,
  salePriceToman: number | null,
) {
  const discountPercent = getDiscountPercent(compareAtPriceToman, salePriceToman);

  return {
    hasDiscount: discountPercent !== null,
    discountPercent,
  };
}
