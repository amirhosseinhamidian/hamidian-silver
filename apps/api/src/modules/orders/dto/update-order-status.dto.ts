import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OrderStatus } from '../../../generated/prisma/enums';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
