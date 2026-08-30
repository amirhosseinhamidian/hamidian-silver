import { IsBoolean, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateCountryDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @Length(1, 160)
  slug!: string;

  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  isoCode!: string;

  @IsOptional()
  @IsUUID('4')
  imageId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
