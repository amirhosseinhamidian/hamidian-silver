import { IsInt, IsUUID, Min } from 'class-validator';

export class SetLowStockThresholdDto {
  @IsUUID('4')
  warehouseId!: string;

  @IsUUID('4')
  variantId!: string;

  @IsInt()
  @Min(0)
  lowStockThreshold!: number;
}
