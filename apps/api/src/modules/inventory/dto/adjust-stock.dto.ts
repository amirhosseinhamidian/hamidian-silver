import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, NotEquals } from 'class-validator';
import { INT32_MAX, INT32_MIN } from '../../../common/int32';

export class AdjustStockDto {
  @IsUUID('4')
  warehouseId!: string;

  @IsUUID('4')
  variantId!: string;

  @IsInt()
  @Min(INT32_MIN)
  @Max(INT32_MAX)
  @NotEquals(0)
  onHandDelta!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
