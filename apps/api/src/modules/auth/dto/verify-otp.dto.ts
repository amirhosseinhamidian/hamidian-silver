import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty({
    description: 'Five-digit one-time verification code',
    example: '12345',
    minLength: 5,
    maxLength: 5,
    pattern: '^\\d{5}$',
  })
  @IsString()
  @Matches(/^\d{5}$/)
  code!: string;
}
