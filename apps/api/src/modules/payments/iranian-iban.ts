const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeIranianIban(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const normalized = [...value.trim().toUpperCase()]
    .map((character) => {
      const persianIndex = PERSIAN_DIGITS.indexOf(character);
      if (persianIndex >= 0) return String(persianIndex);
      const arabicIndex = ARABIC_DIGITS.indexOf(character);
      return arabicIndex >= 0 ? String(arabicIndex) : character;
    })
    .join('')
    .replace(/[\s-]/g, '');

  return normalized.startsWith('IR') ? normalized.slice(2) : normalized;
}

export function hasValidIranianIbanChecksum(ibanNumber: string): boolean {
  if (!/^\d{24}$/.test(ibanNumber)) return false;

  const rearranged = `${ibanNumber.slice(2)}1827${ibanNumber.slice(0, 2)}`;
  let remainder = 0;
  for (const character of rearranged) {
    remainder = (remainder * 10 + Number(character)) % 97;
  }
  return remainder === 1;
}
