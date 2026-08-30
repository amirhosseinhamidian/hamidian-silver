import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { OrderCostEntryType } from '../../../generated/prisma/enums';

export class CreateOrderCostDto {
  @IsUUID('4')
  orderId!: string;

  @IsEnum(OrderCostEntryType)
  type!: OrderCostEntryType;

  @IsInt()
  @Min(1)
  amountToman!: number;

  @IsString()
  @Length(1, 64)
  source!: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  externalReference?: string;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  description?: string;

  @IsString()
  @Length(8, 120)
  idempotencyKey!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
