import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
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
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 96)
  q!: string;
}

export class CampaignProductOptionDto {
  slug!: string;
  name!: string;
}

export class CampaignProductOptionsDto {
  @ApiProperty({ type: () => CampaignProductOptionDto, isArray: true })
  items!: CampaignProductOptionDto[];
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
