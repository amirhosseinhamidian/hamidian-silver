import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SupplierSettlementStatus } from '../../../generated/prisma/enums';

export class ListSupplierSettlementsQueryDto {
  @IsOptional()
  @IsEnum(SupplierSettlementStatus)
  status?: SupplierSettlementStatus;

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
