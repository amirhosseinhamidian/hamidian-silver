import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { INT32_MAX } from '../../../common/int32';

export class SetLowStockThresholdDto {
  @IsUUID('4')
  warehouseId!: string;

  @IsUUID('4')
  variantId!: string;

  @IsInt()
  @Min(0)
  @Max(INT32_MAX)
  lowStockThreshold!: number;
}
