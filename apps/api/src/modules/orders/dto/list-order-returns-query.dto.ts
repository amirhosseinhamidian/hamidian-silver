import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderReturnStatus } from '../../../generated/prisma/enums';

export class ListOrderReturnsQueryDto {
  @IsOptional()
  @IsEnum(OrderReturnStatus)
  status?: OrderReturnStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
