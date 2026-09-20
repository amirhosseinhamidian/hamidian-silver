import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';
import { normalizeIranianIban } from '../iranian-iban';

export class CreateCardToCardAccountDto {
  @IsString()
  @Matches(/^\d{16}$/)
  cardNumber!: string;

  @Transform(({ value }) => normalizeIranianIban(value))
  @IsString()
  @Matches(/^\d{24}$/)
  ibanNumber!: string;

  @IsString()
  @Length(2, 150)
  holderName!: string;

  @IsString()
  @Length(2, 100)
  bankName!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCardToCardAccountDto extends PartialType(CreateCardToCardAccountDto) {}

export class CardToCardAccountResponseDto {
  id!: string;
  cardNumber!: string;

  @ApiProperty({ type: String, nullable: true })
  ibanNumber!: string | null;

  holderName!: string;
  bankName!: string;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PublicCardToCardSettingsDto {
  enabled!: boolean;

  @ApiProperty({ type: String, nullable: true })
  cardNumber!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ibanNumber!: string | null;

  @ApiProperty({ type: String, nullable: true })
  holderName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  bankName!: string | null;
}
