import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PlatingType } from '../../../generated/prisma/enums';
import { PromotionEstimateRequestDto } from './create-order.dto';

export class SavedCartVersionDto {
  @IsUUID('4')
  cartId!: string;

  @IsInt()
  @Min(1)
  revision!: number;
}

export class SaveCartDto extends PromotionEstimateRequestDto {
  @ApiPropertyOptional({ type: () => SavedCartVersionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SavedCartVersionDto)
  current?: SavedCartVersionDto;
}

export class RestoreCartDto extends SavedCartVersionDto {
  @Matches(/^[a-f0-9]{64}$/)
  reviewKey!: string;
}

export class SavedCartPolicyDto {
  @IsBoolean()
  remindersEnabled!: boolean;

  @IsInt()
  @Min(1)
  @Max(168)
  idleHours!: number;

  @IsInt()
  @Min(1)
  @Max(30)
  retentionDays!: number;
}

export class SavedCartStatusDto {
  @ApiProperty({ type: () => SavedCartVersionDto, nullable: true })
  current!: SavedCartVersionDto | null;
  itemCount!: number;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  expiresAt!: string | null;
  showReminder!: boolean;
}

export class RecoveredCartItemDto {
  variantId!: string;
  productSlug!: string;
  productName!: string;
  variantLabel!: string;
  @ApiProperty({ enum: PlatingType, nullable: true })
  platingType!: PlatingType | null;
  unitSalePriceToman!: number;
  unitPlatingPriceToman!: number;
  platingLeadTimeDays!: number;
  quantity!: number;
  maxQuantity!: number;
}

export class SavedCartReviewLineDto {
  productName!: string;
  previousQuantity!: number;
  previousUnitToman!: number;
  @ApiProperty({ type: () => RecoveredCartItemDto, nullable: true })
  item!: RecoveredCartItemDto | null;
}

export class SavedCartReviewDto {
  reviewKey!: string;
  applied!: boolean;
  @ApiProperty({ type: () => SavedCartReviewLineDto, isArray: true })
  lines!: SavedCartReviewLineDto[];
}

export class SavedCartReportDto {
  @ApiProperty({ type: () => SavedCartPolicyDto })
  policy!: SavedCartPolicyDto;
  saved!: number;
  abandoned!: number;
  restored!: number;
  ordered!: number;
  paid!: number;
}
