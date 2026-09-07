import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

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
  @IsBoolean()
  isActive?: boolean;
}
