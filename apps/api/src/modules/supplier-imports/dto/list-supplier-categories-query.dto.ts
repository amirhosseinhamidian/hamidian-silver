import { IsUUID } from 'class-validator';

export class ListSupplierCategoriesQueryDto {
  @IsUUID('4')
  supplierSourceId!: string;
}
