import { ArrayMinSize, ArrayUnique, IsArray, IsInt, IsUUID, Min } from 'class-validator';

export class BulkSetStockDto {
  @IsUUID('4')
  warehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  variantIds!: string[];

  @IsInt()
  @Min(0)
  onHand!: number;
}
