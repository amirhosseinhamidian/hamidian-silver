import { IsUUID } from 'class-validator';

export class SyncSupplierCategoriesDto {
  @IsUUID('4')
  supplierSourceId!: string;
}
