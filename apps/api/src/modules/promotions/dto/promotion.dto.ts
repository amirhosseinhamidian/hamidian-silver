import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { walletQuoteReasons, type WalletPreviewDto } from '../../wallet/dto/customer-wallet.dto';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';
import { PromotionKind } from '../../../generated/prisma/enums';

export class PromotionPercentageOverrideDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  variantId?: string | null;

  @ApiProperty({ minimum: 100, maximum: 5_000 })
  @Type(() => Object)
  @IsInt()
  @Min(100)
  @Max(5_000)
  rateBps!: number;
}

export class SavePromotionDto {
  @ApiProperty({ enum: PromotionKind })
  @IsEnum(PromotionKind)
  kind!: PromotionKind;

  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
  value!: number;

  @ApiPropertyOptional({ type: () => PromotionPercentageOverrideDto, isArray: true, maxItems: 500 })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PromotionPercentageOverrideDto)
  percentageOverrides?: PromotionPercentageOverrideDto[];

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

export class PromotionRateTargetDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;
  productName!: string;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  variantId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  variantLabel!: string | null;
}

export class AdminPromotionDto {
  @ApiProperty({ type: () => SavePromotionDto, nullable: true })
  rule!: SavePromotionDto | null;

  @ApiPropertyOptional({ type: () => PromotionRateTargetDto, isArray: true })
  rateTargets?: PromotionRateTargetDto[];
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

const campaignConditions = [
  'COUPON',
  'CUSTOMER',
  'MINIMUM',
  'ORDER_AMOUNT',
  'BUNDLE',
  'SHIPPING',
] as const;
export type CampaignCondition = (typeof campaignConditions)[number];

export class CampaignUnitPriceDto {
  regularToman!: number;
  discountToman!: number;
  discountPercent!: number;
  finalToman!: number;
}

export class CatalogCampaignOfferDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  campaignId?: string;

  name!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ enum: [...campaignConditions], isArray: true })
  conditions!: CampaignCondition[];

  @ApiProperty({ type: Number, nullable: true })
  minimumToman!: number | null;

  @ApiProperty({ type: () => CampaignUnitPriceDto, nullable: true })
  price!: CampaignUnitPriceDto | null;
}

export class CampaignProductPriceQueryDto {
  @ApiProperty({ maxLength: 220 })
  @IsString()
  @Length(1, 220)
  slug!: string;
}

export class CampaignProductPriceRowDto {
  @ApiProperty({ type: String, nullable: true })
  variantId!: string | null;

  label!: string;
  active!: boolean;

  @ApiProperty({ type: Number, nullable: true })
  regularToman!: number | null;

  @ApiProperty({ type: () => CatalogCampaignOfferDto, nullable: true })
  offer!: CatalogCampaignOfferDto | null;
}

export class CampaignProductPricePreviewDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  productId?: string;
  name!: string;

  @ApiProperty({ type: () => CampaignProductPriceRowDto, isArray: true })
  prices!: CampaignProductPriceRowDto[];
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

  @ApiPropertyOptional({
    description: 'Introductory referral credit included in discountTotalToman.',
  })
  referralDiscountToman?: number;

  @ApiPropertyOptional({ enum: [...walletQuoteReasons], nullable: true })
  walletUnavailableReason?: WalletPreviewDto['walletUnavailableReason'];

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}
