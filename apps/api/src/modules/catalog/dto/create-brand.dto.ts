import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @Length(1, 150)
  name!: string;

  @IsString()
  @Length(1, 180)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(/^\/(?!\/)[^\s?#]*$/)
  seoCanonicalPath?: string;

  @IsOptional()
  @IsBoolean()
  seoNoIndex?: boolean;

  @IsOptional()
  @IsUUID('4')
  seoOgMediaId?: string;

  @IsOptional()
  @IsUUID('4')
  imageId?: string;

  @IsOptional()
  @IsUUID('4')
  originCountryId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
