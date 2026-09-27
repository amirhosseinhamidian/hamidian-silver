import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SupplierProductImportStatus } from '../../../generated/prisma/enums';

export class ListSupplierImportDraftsQueryDto {
  @IsOptional()
  @IsEnum(SupplierProductImportStatus)
  status?: SupplierProductImportStatus;

  @IsOptional()
  @IsUUID('4')
  supplierSourceId?: string;
}
