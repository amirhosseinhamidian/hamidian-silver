const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const integerFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function toAsciiDigits(value: string): string {
  return [...value]
    .map((character) => {
      const persianIndex = PERSIAN_DIGITS.indexOf(character);
      if (persianIndex >= 0) return String(persianIndex);

      const arabicIndex = ARABIC_DIGITS.indexOf(character);
      return arabicIndex >= 0 ? String(arabicIndex) : character;
    })
    .join('');
}

export function formatAdminInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatAdminToman(value: number): string {
  return `${formatAdminInteger(value)} تومان`;
}

export function formatAdminDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

export function formatAdminPhone(value: string): string {
  const digits = toAsciiDigits(value).replace(/\D/g, '');
  const national = digits.startsWith('98') ? `0${digits.slice(2)}` : digits;
  return toPersianDigits(national);
}
