import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PlatingType } from '../../../generated/prisma/enums';
import { PRODUCT_SEO_CANONICAL_PATH_PATTERN } from '../../seo/seo-validation';
import { ProductAttributeInputDto } from './create-product.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsEnum(PlatingType)
  defaultPlatingType?: PlatingType | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(PlatingType, { each: true })
  platingTypes?: PlatingType[];
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
  @Matches(PRODUCT_SEO_CANONICAL_PATH_PATTERN)
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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeInputDto)
  attributes?: ProductAttributeInputDto[];
}
