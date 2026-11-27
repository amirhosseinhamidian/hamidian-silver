import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TOMAN_INT_MAX } from '../../../common/toman';

export class CampaignBudgetDto {
  discountBudgetToman!: number;
  committedDiscountToman!: number;
  @ApiPropertyOptional()
  committedReferralRewardToman?: number;
  remainingDiscountToman!: number;
  usedOrders!: number;

  @ApiProperty({ type: Number, nullable: true })
  remainingUses!: number | null;

  @ApiProperty({ type: String, isArray: true })
  blockers!: string[];

  @ApiProperty({ type: String, isArray: true })
  warnings!: string[];
}

export class CampaignProductQueryDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 96)
  q?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @Length(1, 180)
  category?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @Length(1, 180)
  brand?: string;

  @ApiPropertyOptional({ enum: ['in-stock', 'out-of-stock'] })
  @IsOptional()
  @IsIn(['in-stock', 'out-of-stock'])
  stock?: 'in-stock' | 'out-of-stock';

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  campaignId?: string;

  @ApiPropertyOptional({ enum: ['campaign'] })
  @IsOptional()
  @IsIn(['campaign'])
  scope?: 'campaign';

  @ApiPropertyOptional({ type: String, isArray: true, maxItems: 50 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? [value] : value))
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 220, { each: true })
  selected?: string[];

  @ApiPropertyOptional({ enum: ['direct', 'tree'] })
  @IsOptional()
  @IsIn(['direct', 'tree'])
  categoryMode?: 'direct' | 'tree';
}

export class CampaignNamedOptionDto {
  id!: string;
  slug!: string;
  name!: string;
}

export class CampaignCategoryOptionDto extends CampaignNamedOptionDto {
  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;
  directProductCount!: number;
  subtreeProductCount!: number;
}

export class CampaignTaxonomyOptionsDto {
  @ApiProperty({ type: () => CampaignCategoryOptionDto, isArray: true })
  categories!: CampaignCategoryOptionDto[];
  @ApiProperty({ type: () => CampaignNamedOptionDto, isArray: true })
  brands!: CampaignNamedOptionDto[];
}

export class CampaignCollectionOptionsDto {
  @ApiProperty({ type: () => CampaignNamedOptionDto, isArray: true })
  items!: CampaignNamedOptionDto[];
  page!: number;
  hasMore!: boolean;
}

export class CampaignCollectionOptionsQueryDto extends PickType(CampaignProductQueryDto, [
  'q',
  'page',
]) {
  @ApiPropertyOptional({ enum: ['live'] })
  @IsOptional()
  @IsIn(['live'])
  visibility?: 'live';
}

export class CampaignProductOptionDto extends CampaignNamedOptionDto {
  @ApiProperty({ type: Number, nullable: true })
  defaultPriceToman!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  festivalPriceToman!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  quotaRemaining!: number | null;
  availableQuantity!: number;
  @ApiProperty({ type: String, isArray: true })
  categories!: string[];
  @ApiProperty({ type: String, nullable: true })
  imageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true })
  imageAlt!: string | null;
}

export class CampaignProductOptionsDto {
  @ApiProperty({ type: () => CampaignProductOptionDto, isArray: true })
  items!: CampaignProductOptionDto[];
  page!: number;
  hasMore!: boolean;
}

export class CampaignBasketLineDto {
  @IsString()
  @Length(1, 220)
  slug!: string;

  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @Type(() => Object)
  @IsInt()
  @Min(1)
  @Max(TOMAN_INT_MAX)
  unitSalePriceToman!: number;
}

export class CampaignSimulationInputDto {
  @Type(() => Object)
  @IsInt()
  @Min(1)
  expectedRevision!: number;

  @ApiProperty({ type: () => CampaignBasketLineDto, isArray: true, maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique((line: CampaignBasketLineDto | null) => line?.slug)
  @ValidateNested({ each: true })
  @Type(() => CampaignBasketLineDto)
  items!: CampaignBasketLineDto[];

  @Type(() => Object)
  @IsInt()
  @Min(0)
  @Max(TOMAN_INT_MAX)
  shippingToman!: number;

  @Type(() => Object)
  @IsBoolean()
  hasPaidOrder!: boolean;
}

export class CampaignSimulationDto {
  merchandiseToman!: number;
  eligibleSubtotalToman!: number;
  shippingToman!: number;
  merchandiseDiscountToman!: number;
  shippingDiscountToman!: number;
  payableToman!: number;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;
}
