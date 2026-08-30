import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SupplierCreditStatus } from '../../../generated/prisma/enums';

export class ListSupplierCreditsQueryDto {
  @IsOptional()
  @IsEnum(SupplierCreditStatus)
  status?: SupplierCreditStatus;

  @IsOptional()
  @IsUUID('4')
  supplierId?: string;

  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
