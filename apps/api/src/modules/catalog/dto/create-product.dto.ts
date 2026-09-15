import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductStatus, SizeMode } from '../../../generated/prisma/enums';

export class CreateProductVariantDto {
  @IsString()
  @Length(1, 100)
  sku!: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsUUID('4')
  sizeId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  weightGrams?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductMediaDto {
  @IsUUID('4')
  mediaId!: string;

  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  altText?: string;
}

export class ProductAttributeInputDto {
  @IsString()
  @Length(1, 100)
  key!: string;

  @IsString()
  @Length(1, 500)
  value!: string;

  @IsInt()
  @Min(1)
  sortOrder!: number;
}

export class CreateProductDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsString()
  @Length(1, 220)
  slug!: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

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
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsEnum(SizeMode)
  sizeMode!: SizeMode;

  @IsOptional()
  @IsUUID('4')
  brandId?: string;

  @IsOptional()
  @IsUUID('4')
  countryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePriceToman?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPriceToman?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants!: CreateProductVariantDto[];

  @IsOptional()
  @IsArray()
  @ArrayUnique((item: CreateProductMediaDto) => item.mediaId)
  @ValidateNested({ each: true })
  @Type(() => CreateProductMediaDto)
  media?: CreateProductMediaDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeInputDto)
  attributes?: ProductAttributeInputDto[];
}
