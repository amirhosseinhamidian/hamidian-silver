import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CatalogAttributeKind, CatalogAttributeUnit } from '../../../generated/prisma/enums';
import { CATALOG_ATTRIBUTE_CODE } from './catalog-attribute.dto';
import { PublicCatalogSort } from './public-catalog-query.dto';
import { PublicCatalogProductListDto } from './public-catalog-response.dto';

export enum PublicCatalogAvailability {
  IN_STOCK = 'in-stock',
  OUT_OF_STOCK = 'out-of-stock',
}

export class PublicCatalogFacetFilterDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 64 })
  @IsString()
  @Length(1, 64)
  @Matches(CATALOG_ATTRIBUTE_CODE)
  code!: string;

  @ApiPropertyOptional({ type: String, isArray: true, minItems: 1, maxItems: 16 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  @Matches(CATALOG_ATTRIBUTE_CODE, { each: true })
  values?: string[];

  @ApiPropertyOptional({ type: Number, minimum: -1_000_000, maximum: 1_000_000 })
  @IsOptional()
  @Type(() => Object)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(-1_000_000)
  @Max(1_000_000)
  min?: number;

  @ApiPropertyOptional({ type: Number, minimum: -1_000_000, maximum: 1_000_000 })
  @IsOptional()
  @Type(() => Object)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(-1_000_000)
  @Max(1_000_000)
  max?: number;
}

export class PublicCatalogFacetsQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 1000, default: 1 })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 48, default: 24 })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize?: number;

  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 100 })
  @IsOptional()
  @Type(() => Object)
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 180 })
  @IsOptional()
  @Type(() => Object)
  @IsString()
  @Length(1, 180)
  scopeCategory?: string;

  @ApiPropertyOptional({ type: String, minLength: 1, maxLength: 180 })
  @IsOptional()
  @Type(() => Object)
  @IsString()
  @Length(1, 180)
  scopeBrand?: string;

  @ApiPropertyOptional({ type: String, isArray: true, maxItems: 16 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 180, { each: true })
  categories?: string[];

  @ApiPropertyOptional({ type: String, isArray: true, maxItems: 16 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 180, { each: true })
  brands?: string[];

  @ApiPropertyOptional({ enum: PublicCatalogAvailability })
  @IsOptional()
  @Type(() => Object)
  @IsEnum(PublicCatalogAvailability)
  availability?: PublicCatalogAvailability;

  @ApiPropertyOptional({ type: String, isArray: true, maxItems: 16 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  sizeIds?: string[];

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 2147483647 })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  minPriceToman?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 2147483647 })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  maxPriceToman?: number;

  @ApiPropertyOptional({ type: Number, minimum: 0.001, maximum: 9999999.999 })
  @IsOptional()
  @Type(() => Object)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999999.999)
  minWeightGrams?: number;

  @ApiPropertyOptional({ type: Number, minimum: 0.001, maximum: 9999999.999 })
  @IsOptional()
  @Type(() => Object)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999999.999)
  maxWeightGrams?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100000 })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(100000)
  minLengthMm?: number;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100000 })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(100000)
  maxLengthMm?: number;

  @ApiPropertyOptional({ type: () => PublicCatalogFacetFilterDto, isArray: true, maxItems: 8 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => PublicCatalogFacetFilterDto)
  attributes?: PublicCatalogFacetFilterDto[];

  @ApiPropertyOptional({ enum: PublicCatalogSort, default: PublicCatalogSort.NEWEST })
  @IsOptional()
  @Type(() => Object)
  @IsEnum(PublicCatalogSort)
  sort?: PublicCatalogSort;
}

export class PublicCatalogFacetOptionDto {
  @ApiProperty({ type: String })
  value!: string;
  @ApiProperty({ type: String })
  label!: string;
  @ApiProperty({ type: Number })
  count!: number;
}

export class PublicCatalogFacetRangeDto {
  @ApiProperty({ type: Number })
  min!: number;
  @ApiProperty({ type: Number })
  max!: number;
  @ApiProperty({ type: Number })
  count!: number;
}

export class PublicCatalogAttributeFacetDto {
  @ApiProperty({ type: String })
  code!: string;
  @ApiProperty({ type: String })
  label!: string;
  @ApiProperty({ enum: CatalogAttributeKind })
  kind!: CatalogAttributeKind;
  @ApiProperty({ enum: CatalogAttributeUnit })
  unit!: CatalogAttributeUnit;
  @ApiProperty({ type: () => PublicCatalogFacetOptionDto, isArray: true })
  options!: PublicCatalogFacetOptionDto[];
  @ApiProperty({ type: () => PublicCatalogFacetRangeDto, nullable: true })
  range!: PublicCatalogFacetRangeDto | null;
}

export class PublicCatalogFacetsDto {
  @ApiProperty({ type: () => PublicCatalogFacetOptionDto, isArray: true })
  categories!: PublicCatalogFacetOptionDto[];
  @ApiProperty({ type: () => PublicCatalogFacetOptionDto, isArray: true })
  brands!: PublicCatalogFacetOptionDto[];
  @ApiProperty({ type: () => PublicCatalogFacetOptionDto, isArray: true })
  availability!: PublicCatalogFacetOptionDto[];
  @ApiProperty({ type: () => PublicCatalogFacetOptionDto, isArray: true })
  sizes!: PublicCatalogFacetOptionDto[];
  @ApiProperty({ type: () => PublicCatalogFacetRangeDto, nullable: true })
  priceToman!: PublicCatalogFacetRangeDto | null;
  @ApiProperty({ type: () => PublicCatalogFacetRangeDto, nullable: true })
  weightGrams!: PublicCatalogFacetRangeDto | null;
  @ApiProperty({ type: () => PublicCatalogFacetRangeDto, nullable: true })
  lengthMm!: PublicCatalogFacetRangeDto | null;
  @ApiProperty({ type: () => PublicCatalogAttributeFacetDto, isArray: true })
  attributes!: PublicCatalogAttributeFacetDto[];
}

export class PublicFacetedCatalogDto extends PublicCatalogProductListDto {
  @ApiProperty({ type: () => PublicCatalogFacetsDto })
  facets!: PublicCatalogFacetsDto;
}
