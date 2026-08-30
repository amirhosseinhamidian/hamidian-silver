import { IsOptional, IsUUID } from 'class-validator';

export class ListInventoryQueryDto {
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;
}
