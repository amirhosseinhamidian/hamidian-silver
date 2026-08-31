import { ArrayMinSize, ArrayUnique, IsArray, IsInt, IsUUID, Max, Min } from 'class-validator';
import { INT32_MAX } from '../../../common/int32';

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
  @Max(INT32_MAX)
  onHand!: number;
}
