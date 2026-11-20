export function normalizeCatalogSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('fa-IR')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) % 16))
    .replace(/[\u0640\u064b-\u065f\u0670\u061c\u200e\u200f]/g, '')
    .replace(/[\u200c\u200d_\u2010-\u2015-]/g, ' ')
    .replaceAll('\0', '')
    .replace(/\s+/g, ' ')
    .trim();
}
