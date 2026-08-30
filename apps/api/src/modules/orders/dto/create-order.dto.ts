import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PlatingType } from '../../../generated/prisma/enums';

export class CreateOrderAddressDto {
  @IsString()
  @Length(2, 150)
  recipientName!: string;

  @IsString()
  @Length(10, 20)
  phone!: string;

  @IsString()
  @Length(2, 100)
  province!: string;

  @IsString()
  @Length(2, 100)
  city!: string;

  @IsString()
  @Length(5, 1000)
  addressLine!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  postalCode!: string;
}

export class CreateOrderItemDto {
  @IsUUID('4')
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @IsEnum(PlatingType)
  platingType?: PlatingType;
}

export class CreateOrderDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateOrderAddressDto)
  shippingAddress!: CreateOrderAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreateOrderItemDto) => `${item.variantId}:${item.platingType ?? 'NONE'}`)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
