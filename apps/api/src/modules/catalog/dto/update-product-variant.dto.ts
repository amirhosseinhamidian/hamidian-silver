import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { VariantInventoryMode } from '../../../generated/prisma/enums';
import { ProductVariantComponentInputDto } from './create-product.dto';

export class UpdateProductVariantDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string | null;

  @IsOptional()
  @IsUUID('4')
  sizeId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  weightGrams?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  lengthMm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePriceToman?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPriceToman?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(VariantInventoryMode)
  inventoryMode?: VariantInventoryMode;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((item: ProductVariantComponentInputDto) => item.componentSku.trim().toLowerCase())
  @ValidateNested({ each: true })
  @Type(() => ProductVariantComponentInputDto)
  components?: ProductVariantComponentInputDto[];
}
