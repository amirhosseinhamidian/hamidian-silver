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

export function formatAdminMoneyInput(value: string | number): string {
  const digits = toAsciiDigits(String(value)).replace(/\D/g, '');
  if (!digits) return '';
  const normalized = digits.replace(/^0+(?=\d)/, '');
  return toPersianDigits(normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '٬'));
}

export function parseAdminMoneyInput(value: string): number | null {
  const digits = toAsciiDigits(value).replace(/\D/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const ONES = [
  '',
  'یک',
  'دو',
  'سه',
  'چهار',
  'پنج',
  'شش',
  'هفت',
  'هشت',
  'نه',
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
] as const;
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'] as const;
const HUNDREDS = [
  '',
  'صد',
  'دویست',
  'سیصد',
  'چهارصد',
  'پانصد',
  'ششصد',
  'هفتصد',
  'هشتصد',
  'نهصد',
] as const;
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'] as const;

function joinWords(parts: readonly string[]): string {
  return parts.filter(Boolean).join(' و ');
}

function threeDigitWords(value: number): string {
  const hundred = Math.floor(value / 100);
  const remainder = value % 100;
  if (remainder < 20) return joinWords([HUNDREDS[hundred] ?? '', ONES[remainder] ?? '']);
  return joinWords([
    HUNDREDS[hundred] ?? '',
    TENS[Math.floor(remainder / 10)] ?? '',
    ONES[remainder % 10] ?? '',
  ]);
}

export function adminMoneyToWords(value: number): string | null {
  if (!Number.isSafeInteger(value) || value < 0 || value >= 1_000_000_000_000_000) return null;
  if (value === 0) return 'صفر';

  const groups: string[] = [];
  let remaining = value;
  let scaleIndex = 0;
  while (remaining > 0) {
    const group = remaining % 1000;
    if (group) {
      const scale = SCALES[scaleIndex] ?? '';
      groups.unshift([threeDigitWords(group), scale].filter(Boolean).join(' '));
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }
  return joinWords(groups);
}
