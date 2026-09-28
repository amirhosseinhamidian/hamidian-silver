import { IsOptional, IsUUID } from 'class-validator';

export class UpdateSupplierCategoryMappingDto {
  @IsOptional()
  @IsUUID('4')
  catalogCategoryId?: string | null;
}
