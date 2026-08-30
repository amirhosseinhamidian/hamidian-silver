import { IsInt, IsOptional, IsString, IsUUID, Length, NotEquals } from 'class-validator';

export class AdjustStockDto {
  @IsUUID('4')
  warehouseId!: string;

  @IsUUID('4')
  variantId!: string;

  @IsInt()
  @NotEquals(0)
  onHandDelta!: number;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
