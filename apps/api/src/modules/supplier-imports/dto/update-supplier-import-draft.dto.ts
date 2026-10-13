import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SupplierProductImportStatus } from '../../../generated/prisma/enums';

class SupplierImportAttributeDto {
  @IsString()
  @Length(1, 100)
  key!: string;

  @IsString()
  @Length(1, 500)
  value!: string;
}

export class UpdateSupplierImportDraftDto {
  @IsOptional()
  @IsString()
  @Length(1, 300)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  sourceCategory?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  supplierRetailPriceToman?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  weightGrams?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SupplierImportAttributeDto)
  attributes?: SupplierImportAttributeDto[];

  @IsOptional()
  @IsEnum(SupplierProductImportStatus)
  status?: SupplierProductImportStatus;
}
