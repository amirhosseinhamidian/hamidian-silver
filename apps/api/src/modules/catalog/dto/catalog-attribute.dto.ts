import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import {
  CatalogAttributeKind,
  CatalogAttributeSource,
  CatalogAttributeUnit,
} from '../../../generated/prisma/enums';

export const CATALOG_ATTRIBUTE_CODE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export class CatalogAttributeOptionDto {
  @IsString()
  @Length(1, 64)
  @Matches(CATALOG_ATTRIBUTE_CODE)
  code!: string;

  @IsString()
  @Length(1, 100)
  label!: string;
}

export class CatalogAttributeValueDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  optionCode?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @ArrayUnique()
  @IsString({ each: true })
  optionCodes?: string[];

  @IsOptional()
  @Type(() => Object)
  @IsNumber({ maxDecimalPlaces: 3 })
  number?: number;

  @IsOptional()
  @Type(() => Object)
  @IsNumber({ maxDecimalPlaces: 3 })
  min?: number;

  @IsOptional()
  @Type(() => Object)
  @IsNumber({ maxDecimalPlaces: 3 })
  max?: number;

  @IsOptional()
  @Type(() => Object)
  @IsBoolean()
  boolean?: boolean;

  @IsOptional()
  @ApiPropertyOptional({ enum: CatalogAttributeUnit })
  @IsEnum(CatalogAttributeUnit)
  unit?: CatalogAttributeUnit;
}

export class CatalogAttributeLegacyMappingDto {
  @IsString()
  @Length(1, 500)
  legacyValue!: string;

  @ApiProperty({ type: () => CatalogAttributeValueDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CatalogAttributeValueDto)
  value!: CatalogAttributeValueDto;
}

export class CatalogAttributeConfigDto {
  @IsString()
  @Length(1, 100)
  label!: string;

  @ApiProperty({ enum: CatalogAttributeKind })
  @IsEnum(CatalogAttributeKind)
  kind!: CatalogAttributeKind;

  @ApiProperty({ enum: CatalogAttributeUnit })
  @IsEnum(CatalogAttributeUnit)
  unit!: CatalogAttributeUnit;

  @ApiProperty({ enum: CatalogAttributeSource })
  @IsEnum(CatalogAttributeSource)
  source!: CatalogAttributeSource;

  @Type(() => Object)
  @IsBoolean()
  isActive!: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Type(() => Object)
  @IsBoolean()
  isRequired?: boolean;

  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder!: number;

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds!: string[];

  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  excludedCategoryIds!: string[];

  @ApiProperty({ type: () => CatalogAttributeOptionDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => CatalogAttributeOptionDto)
  options!: CatalogAttributeOptionDto[];

  @ApiProperty({ type: () => CatalogAttributeLegacyMappingDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CatalogAttributeLegacyMappingDto)
  legacyMappings!: CatalogAttributeLegacyMappingDto[];
}

export class CreateCatalogAttributeDto extends CatalogAttributeConfigDto {
  @IsString()
  @Length(1, 64)
  @Matches(CATALOG_ATTRIBUTE_CODE)
  code!: string;
}

export class UpdateCatalogAttributeDto extends CatalogAttributeConfigDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CatalogAttributeDefinitionDto extends CatalogAttributeConfigDto {
  code!: string;
  version!: number;
}

export class SetCatalogProductAttributeDto {
  @IsInt()
  @Min(1)
  definitionVersion!: number;

  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CatalogAttributeValueDto)
  value?: CatalogAttributeValueDto;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  legacyValue?: string;

  @IsOptional()
  @Type(() => Object)
  @IsBoolean()
  clear?: boolean;
}

export class CatalogProductAttributeDto {
  @ApiProperty({ type: () => CatalogAttributeDefinitionDto })
  definition!: CatalogAttributeDefinitionDto;

  @ApiProperty({ type: () => CatalogAttributeValueDto, nullable: true })
  value!: CatalogAttributeValueDto | null;

  revision!: number;

  @ApiPropertyOptional()
  needsCompletion?: boolean;

  @ApiProperty({ type: Number, nullable: true })
  definitionVersion!: number | null;

  @ApiProperty({ type: String, nullable: true })
  legacyValue!: string | null;
}

export class PublicTypedCatalogAttributeDto {
  code!: string;
  label!: string;
  definitionVersion!: number;

  @ApiProperty({ enum: CatalogAttributeKind })
  kind!: CatalogAttributeKind;

  @ApiProperty({ enum: CatalogAttributeUnit })
  unit!: CatalogAttributeUnit;

  @ApiProperty({ type: () => CatalogAttributeOptionDto, isArray: true })
  options!: CatalogAttributeOptionDto[];

  @ApiProperty({ type: () => CatalogAttributeValueDto })
  value!: CatalogAttributeValueDto;
}
