import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateCardToCardAccountDto {
  @IsString()
  @Matches(/^\d{16}$/)
  cardNumber!: string;

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
  holderName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  bankName!: string | null;
}
