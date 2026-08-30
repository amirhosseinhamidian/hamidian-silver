import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderReturnItemDto {
  @IsUUID('4')
  orderItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderReturnItemDto)
  items!: CreateOrderReturnItemDto[];

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  reason?: string;
}
