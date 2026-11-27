import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { CampaignQuotaTotalsDto } from '../../campaigns/dto/campaign-operations-center.dto';
import { GrowthDashboardGroupDto, GrowthDashboardMetricsDto } from './growth-dashboard.dto';
import { GrowthRevenuePeriodDto, GrowthRevenueQueryDto } from './growth-revenue.dto';

export class GrowthCampaignPerformancePathDto {
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/)
  campaignId!: string;
}

export class GrowthCampaignPerformanceQueryDto extends PickType(GrowthRevenueQueryDto, [
  'from',
  'to',
] as const) {
  @ApiPropertyOptional({ minimum: 1, maximum: 10_000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10_000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  contentPage?: number;
}

export class GrowthCampaignBudgetDto {
  budgetToman!: number;

  @ApiProperty({ type: Number, nullable: true })
  plannedChannelCostToman!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  lifetimeMediaSpendToman!: number | null;

  lifetimeCommittedDiscountToman!: number;
  @ApiPropertyOptional()
  lifetimeCommittedReferralRewardToman?: number;
  unpaidDiscountCommitmentToman!: number;
  remainingDiscountToman!: number;

  @ApiProperty({ type: Number, nullable: true })
  mediaVarianceToman!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  budgetVarianceToman!: number | null;
}

export class GrowthCampaignOfferPerformanceDto {
  submittedOrders!: number;
  confirmedOrders!: number;
  collectedToman!: number;
  refundedToman!: number;
  netCollectedToman!: number;

  @ApiProperty({ type: Number, nullable: true })
  conversionPercent!: number | null;

  @ApiProperty({ type: () => CampaignQuotaTotalsDto })
  quota!: CampaignQuotaTotalsDto;
}

export class GrowthCampaignTrackingContentDto {
  source!: string;
  medium!: string;
  content!: string;
  submittedOrders!: number;
  confirmedOrders!: number;
  netCollectedToman!: number;
}

const spendCoverageStates = [
  'MATCHED',
  'NO_COST',
  'NON_POSITIVE_COST',
  'NO_CONFIRMED_ORDERS',
  'INCOMPLETE_COST',
] as const;

export class GrowthCampaignHistoryItemDto {
  @ApiProperty({ enum: ['attribution', 'cancellation'] })
  kind!: 'attribution' | 'cancellation';

  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ type: String, nullable: true })
  model!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  policyVersion!: number | null;

  @ApiProperty({ type: String, nullable: true })
  firstCampaignId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastCampaignId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  selectedCampaignId!: string | null;
}

export class GrowthCampaignPerformanceDto {
  campaignId!: string;
  campaign!: string;

  @ApiProperty({ format: 'uuid', type: String, nullable: true })
  managedCampaignId!: string | null;

  @ApiProperty({ enum: ['SALES', 'MARKETING', 'FESTIVAL', 'LEGACY', 'TRACKING_ONLY'] })
  campaignType!: 'SALES' | 'MARKETING' | 'FESTIVAL' | 'LEGACY' | 'TRACKING_ONLY';

  @ApiProperty({ type: () => GrowthRevenuePeriodDto })
  period!: GrowthRevenuePeriodDto;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ type: () => GrowthDashboardMetricsDto })
  totals!: GrowthDashboardMetricsDto;

  @ApiProperty({ enum: spendCoverageStates })
  spendCoverage!: (typeof spendCoverageStates)[number];

  @ApiProperty({ type: () => GrowthCampaignOfferPerformanceDto, nullable: true })
  offer!: GrowthCampaignOfferPerformanceDto | null;

  @ApiProperty({ type: () => GrowthDashboardGroupDto, isArray: true })
  channels!: GrowthDashboardGroupDto[];
  channelCount!: number;

  @ApiProperty({ type: () => GrowthCampaignTrackingContentDto, isArray: true })
  trackingContents!: GrowthCampaignTrackingContentDto[];
  contentPage!: number;
  hasMoreTrackingContents!: boolean;

  newCustomers!: number;

  @ApiProperty({ type: Number, nullable: true })
  cacToman!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  roas!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  merchandiseDiscountToman!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  shippingDiscountToman!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  consumedCreditToman!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  issuedRewardToman!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  outstandingRewardCommitmentToman!: number | null;

  @ApiProperty({ type: () => GrowthCampaignBudgetDto, nullable: true })
  budget!: GrowthCampaignBudgetDto | null;

  @ApiProperty({ type: () => GrowthCampaignHistoryItemDto, isArray: true })
  history!: GrowthCampaignHistoryItemDto[];

  page!: number;
  hasMoreHistory!: boolean;
}
