import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { OrderCostEntryType } from '../../../generated/prisma/enums';

export class ListOrderCostsQueryDto {
  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsEnum(OrderCostEntryType)
  type?: OrderCostEntryType;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
