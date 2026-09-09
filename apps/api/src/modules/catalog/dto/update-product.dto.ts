import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 220)
  slug?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(/^\/(?!\/)[^\s?#]*$/)
  seoCanonicalPath?: string | null;

  @IsOptional()
  @IsBoolean()
  seoNoIndex?: boolean;

  @IsOptional()
  @IsUUID('4')
  seoOgMediaId?: string | null;

  @IsOptional()
  @IsUUID('4')
  brandId?: string | null;

  @IsOptional()
  @IsUUID('4')
  countryId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePriceToman?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPriceToman?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[];
}
