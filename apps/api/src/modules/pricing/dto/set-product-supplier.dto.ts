import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SetProductSupplierDto {
  @IsInt()
  @Min(0)
  supplierPriceToman!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(10000)
  markupPercent?: number;

  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
