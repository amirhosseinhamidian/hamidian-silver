import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';
import { PromotionKind } from '../../../generated/prisma/enums';

export class SavePromotionDto {
  @ApiProperty({ enum: PromotionKind })
  @IsEnum(PromotionKind)
  kind!: PromotionKind;

  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
  value!: number;

  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
  minSubtotalToman!: number;

  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(TOMAN_INT_MAX)
  maxDiscountToman!: number;

  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(5_000)
  maxDiscountBps!: number;

  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(100)
  priority!: number;

  @ApiProperty({ type: String, isArray: true, maxItems: 10 })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(220, { each: true })
  bundleProductSlugs!: string[];

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 32 })
  @IsOptional()
  @Type(() => Object)
  @IsString()
  @MaxLength(32)
  couponCode?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1, maximum: 1_000_000 })
  @IsOptional()
  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxUses?: number | null;

  @Type(() => Object)
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class AdminPromotionDto {
  @ApiProperty({ type: () => SavePromotionDto, nullable: true })
  rule!: SavePromotionDto | null;
}

export class PublicPromotionDto {
  name!: string;

  @ApiProperty({ enum: PromotionKind })
  kind!: PromotionKind;

  allProducts!: boolean;

  @ApiProperty({ type: String, isArray: true })
  productIds!: string[];

  @ApiProperty({ type: String, isArray: true })
  categoryIds!: string[];

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
}

export class PublicPromotionsDto {
  available!: boolean;

  @ApiProperty({ type: () => PublicPromotionDto, isArray: true })
  items!: PublicPromotionDto[];
}

export class PromotionEstimateDto {
  merchandiseTotalToman!: number;
  platingTotalToman!: number;
  discountTotalToman!: number;
  shippingTotalToman!: number;
  shippingDiscountToman!: number;
  walletAppliedToman!: number;
  payableToman!: number;

  @ApiProperty({ type: String, nullable: true })
  campaignName!: string | null;
}

export class CheckoutPriceQuoteDto extends PromotionEstimateDto {
  quoteToken!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}
