import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { OrderReturnDisposition } from '../../../generated/prisma/enums';

export class ReceiveOrderReturnItemDto {
  @IsUUID('4')
  returnItemId!: string;

  @IsEnum(OrderReturnDisposition)
  disposition!: OrderReturnDisposition;
}

export class ReceiveOrderReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReceiveOrderReturnItemDto)
  items!: ReceiveOrderReturnItemDto[];

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  note?: string;
}
