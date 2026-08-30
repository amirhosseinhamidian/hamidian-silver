import { BadRequestException } from '@nestjs/common';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toAsciiDigits(value: string): string {
  return [...value]
    .map((character) => {
      const persianIndex = PERSIAN_DIGITS.indexOf(character);

      if (persianIndex >= 0) {
        return String(persianIndex);
      }

      const arabicIndex = ARABIC_DIGITS.indexOf(character);

      if (arabicIndex >= 0) {
        return String(arabicIndex);
      }

      return character;
    })
    .join('');
}

export function normalizeIranianMobile(value: string): string {
  const compact = toAsciiDigits(value.trim()).replace(/[\s()-]/g, '');

  let nationalNumber = compact;

  if (nationalNumber.startsWith('0098')) {
    nationalNumber = nationalNumber.slice(4);
  } else if (nationalNumber.startsWith('+98')) {
    nationalNumber = nationalNumber.slice(3);
  } else if (nationalNumber.startsWith('98')) {
    nationalNumber = nationalNumber.slice(2);
  } else if (nationalNumber.startsWith('0')) {
    nationalNumber = nationalNumber.slice(1);
  }

  if (!/^9\d{9}$/.test(nationalNumber)) {
    throw new BadRequestException('A valid Iranian mobile number is required.');
  }

  return `+98${nationalNumber}`;
}
