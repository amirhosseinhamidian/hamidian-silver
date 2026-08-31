import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';

export class SetProductSupplierDto {
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
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
