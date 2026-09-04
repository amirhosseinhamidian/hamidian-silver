const westernIntegerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});
const persianDigits = '۰۱۲۳۴۵۶۷۸۹';

function formatPersianGroupedInteger(value: number): string {
  return westernIntegerFormatter
    .format(value)
    .replace(/\d/g, (digit) => persianDigits[Number(digit)] ?? digit);
}

export function formatTomanPrice(value: number | null): string {
  if (value === null) {
    return 'برای اطلاع از قیمت تماس بگیرید';
  }

  return `${formatPersianGroupedInteger(value)} تومان`;
}
