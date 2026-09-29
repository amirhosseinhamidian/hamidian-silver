import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SupplierProductImportStatus } from '../../../generated/prisma/enums';

export class ListSupplierImportDraftsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(96)
  pageSize = 24;

  @IsOptional()
  @IsEnum(SupplierProductImportStatus)
  status?: SupplierProductImportStatus;

  @IsOptional()
  @IsUUID('4')
  supplierSourceId?: string;
}
