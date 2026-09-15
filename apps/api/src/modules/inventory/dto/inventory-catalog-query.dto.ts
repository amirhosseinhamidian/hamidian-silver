import { IsUUID } from 'class-validator';

export class InventoryCatalogQueryDto {
  @IsUUID('4')
  warehouseId!: string;
}
