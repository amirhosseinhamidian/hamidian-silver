import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PlatingType } from '../../../generated/prisma/enums';
import { SessionAttributionDto } from '../../growth-attribution/dto/attribution.dto';
import { growthDevices } from '../../growth-attribution/dto/growth-dashboard.dto';

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

export class PromotionEstimateRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((item: CreateOrderItemDto) => `${item.variantId}:${item.platingType ?? 'NONE'}`)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class CreateOrderDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Apply the maximum eligible wallet credit.' })
  @IsOptional()
  @Type(() => Object)
  @IsBoolean()
  useWalletCredit?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Apply the eligible introductory referral credit.',
  })
  @IsOptional()
  @Type(() => Object)
  @IsBoolean()
  useReferralCredit?: boolean;

  @IsOptional()
  @Type(() => Object)
  @IsString()
  @MaxLength(32)
  couponCode?: string;

  @IsOptional()
  @Type(() => Object)
  @IsString()
  @MaxLength(160)
  quoteToken?: string;

  @ApiPropertyOptional({ type: () => SessionAttributionDto })
  @Allow()
  attribution?: unknown;

  @ApiPropertyOptional({ enum: [...growthDevices] })
  @IsOptional()
  @IsIn(growthDevices)
  growthDevice?: (typeof growthDevices)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerNote?: string;

  @IsOptional()
  @IsUUID('4')
  shippingCarrierId?: string;

  @IsOptional()
  @IsUUID('4')
  userAddressId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateOrderAddressDto)
  shippingAddress?: CreateOrderAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreateOrderItemDto) => `${item.variantId}:${item.platingType ?? 'NONE'}`)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
