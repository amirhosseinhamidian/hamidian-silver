import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CampaignQuotaAdminDto } from './campaign-quota.dto';

export const campaignOrderStates = [
  'PENDING',
  'CONFIRMED',
  'RECEIPT_REVIEW',
  'RECEIPT_REJECTED',
  'PAYMENT_FAILED',
  'RECONCILIATION',
  'CANCELLED',
  'EXPIRED',
] as const;
export type CampaignOrderState = (typeof campaignOrderStates)[number];

export class CampaignOperationsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  orderPage?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quotaPage?: number;

  @ApiPropertyOptional({ enum: campaignOrderStates })
  @IsOptional()
  @IsIn(campaignOrderStates)
  orderState?: CampaignOrderState;
}

export class CampaignOrderCountsDto {
  registered!: number;
  confirmed!: number;
  awaitingReceipt!: number;
  rejectedReceipt!: number;
  pending!: number;
  paymentFailed!: number;
  reconciliation!: number;
  cancelled!: number;
  expired!: number;
  overdueReservations!: number;
}

export class CampaignOrderOperationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  number!: string;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ enum: campaignOrderStates })
  state!: CampaignOrderState;

  discountApplied!: boolean;
}

export class CampaignQuotaOperationDto extends CampaignQuotaAdminDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  stockShortfall!: number;
}

export class CampaignQuotaTotalsDto {
  products!: number;
  limit!: number;
  siteSold!: number;
  reserved!: number;
  manualSold!: number;
  remaining!: number;
}

export class CampaignOperationsFinanceDto {
  confirmedMerchandiseDiscountToman!: number;
  confirmedShippingDiscountToman!: number;
}

export class CampaignOperationsCenterDto {
  @ApiProperty({ type: () => CampaignOrderCountsDto })
  orders!: CampaignOrderCountsDto;

  @ApiProperty({ type: () => CampaignOrderOperationDto, isArray: true })
  orderItems!: CampaignOrderOperationDto[];

  orderPage!: number;
  hasMoreOrders!: boolean;

  @ApiProperty({ type: () => CampaignQuotaTotalsDto })
  quota!: CampaignQuotaTotalsDto;

  @ApiProperty({ type: () => CampaignQuotaOperationDto, isArray: true })
  quotaItems!: CampaignQuotaOperationDto[];

  quotaPage!: number;
  hasMoreQuotas!: boolean;

  @ApiProperty({ type: () => CampaignOperationsFinanceDto, nullable: true })
  finance!: CampaignOperationsFinanceDto | null;

  @ApiProperty({ type: String, nullable: true })
  landingSlug!: string | null;

  @ApiProperty({ enum: ['NO_LANDING', 'INACTIVE', 'EMPTY', 'LIVE', 'UNKNOWN'] })
  publication!: 'NO_LANDING' | 'INACTIVE' | 'EMPTY' | 'LIVE' | 'UNKNOWN';

  @ApiProperty({ format: 'date-time' })
  checkedAt!: string;
}
