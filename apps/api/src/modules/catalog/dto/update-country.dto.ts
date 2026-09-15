import { IsBoolean, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class UpdateCountryDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  slug?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  isoCode?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID('4')
  imageId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
