import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SupplierPayableStatus } from '../../../generated/prisma/enums';

export class ListSupplierPayablesQueryDto {
  @IsOptional()
  @IsEnum(SupplierPayableStatus)
  status?: SupplierPayableStatus;

  @IsOptional()
  @IsUUID('4')
  supplierId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
