const tomanFormatter = new Intl.NumberFormat('fa-IR');

export function formatTomanPrice(value: number | null): string {
  if (value === null) {
    return 'برای اطلاع از قیمت تماس بگیرید';
  }

  return `${tomanFormatter.format(value)} تومان`;
}
