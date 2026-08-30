import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PlatingFulfillmentStatus } from '../../../generated/prisma/enums';

export class ListPlatingFulfillmentsQueryDto {
  @IsOptional()
  @IsEnum(PlatingFulfillmentStatus)
  status?: PlatingFulfillmentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
