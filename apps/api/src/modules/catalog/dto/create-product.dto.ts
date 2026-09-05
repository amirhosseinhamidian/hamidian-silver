import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
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
}
