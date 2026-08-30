import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function normalizeOtpDigits(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return [...value.trim()]
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

export class VerifyOtpDto {
  @IsString()
  @Length(10, 20)
  phone!: string;

  @Transform(({ value }) => normalizeOtpDigits(value))
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
