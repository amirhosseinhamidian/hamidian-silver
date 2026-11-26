import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import {
  GrowthRevenuePeriodDto,
  GrowthRevenueQueryDto,
} from '../../growth-attribution/dto/growth-revenue.dto';
import { CampaignBudgetDto } from './campaign-operations.dto';
import {
  CampaignQuotaOperationDto,
  CampaignQuotaTotalsDto,
  campaignOrderStates,
  type CampaignOrderState,
} from './campaign-operations-center.dto';

export const festivalReportSections = [
  'products',
  'categories',
  'brands',
  'offers',
  'sources',
  'orders',
  'quotas',
] as const;
export const festivalReportSorts = ['desc', 'asc'] as const;

export class FestivalAnalyticsQueryDto extends PickType(GrowthRevenueQueryDto, [
  'from',
  'to',
] as const) {
  @ApiPropertyOptional({ maxLength: 220 })
  @IsOptional()
  @IsString()
  @Length(1, 220)
  product?: string;

  @ApiPropertyOptional({ maxLength: 220 })
  @IsOptional()
  @IsString()
  @Length(1, 220)
  category?: string;

  @ApiPropertyOptional({ enum: campaignOrderStates })
  @IsOptional()
  @IsIn(campaignOrderStates)
  orderState?: CampaignOrderState;

  @ApiPropertyOptional({ enum: festivalReportSections })
  @IsOptional()
  @IsIn(festivalReportSections)
  section?: (typeof festivalReportSections)[number];

  @ApiPropertyOptional({ enum: festivalReportSorts })
  @IsOptional()
  @IsIn(festivalReportSorts)
  sort?: (typeof festivalReportSorts)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;
}

export class FestivalSalesTotalsDto {
  orders!: number;
  confirmedOrders!: number;
  units!: number;
  collectedToman!: number;
  discountToman!: number;

  @ApiProperty({ type: Number, nullable: true })
  averageOrderToman!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  orderConfirmationPercent!: number | null;
}

export class FestivalDailySalesDto {
  @ApiProperty({ format: 'date' })
  day!: string;

  confirmedOrders!: number;
  collectedToman!: number;
}

export class FestivalSalesGroupDto {
  key!: string;
  label!: string;

  @ApiProperty({ type: String, nullable: true })
  slug!: string | null;

  orders!: number;

  @ApiProperty({ type: Number, nullable: true })
  units!: number | null;

  amountToman!: number;
}

export class FestivalOrderStatusCountDto {
  @ApiProperty({ enum: campaignOrderStates })
  state!: CampaignOrderState;

  orders!: number;
}

export class FestivalReportOrderDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  number!: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ enum: campaignOrderStates })
  state!: CampaignOrderState;

  @ApiProperty({ type: Number, nullable: true })
  collectedToman!: number | null;
}

export class FestivalMeasuredFunnelDto {
  visits!: number;
  listVisits!: number;
  itemVisits!: number;
  cartVisits!: number;
  checkoutVisits!: number;
}

export class FestivalAnalyticsDto {
  @ApiProperty({ format: 'uuid' })
  campaignId!: string;

  name!: string;

  @ApiProperty({ format: 'date-time' })
  checkedAt!: string;

  @ApiProperty({ type: () => GrowthRevenuePeriodDto })
  period!: GrowthRevenuePeriodDto;

  @ApiProperty({ type: () => FestivalSalesTotalsDto })
  totals!: FestivalSalesTotalsDto;

  @ApiProperty({ type: () => FestivalDailySalesDto, isArray: true })
  daily!: FestivalDailySalesDto[];

  @ApiProperty({ type: () => FestivalSalesGroupDto, isArray: true })
  topProducts!: FestivalSalesGroupDto[];

  @ApiProperty({ type: () => FestivalSalesGroupDto, isArray: true })
  topCategories!: FestivalSalesGroupDto[];

  @ApiProperty({ type: () => FestivalSalesGroupDto, isArray: true })
  topSources!: FestivalSalesGroupDto[];

  @ApiProperty({ type: () => FestivalMeasuredFunnelDto, nullable: true })
  funnel!: FestivalMeasuredFunnelDto | null;

  @ApiProperty({ type: () => FestivalOrderStatusCountDto, isArray: true })
  states!: FestivalOrderStatusCountDto[];

  @ApiProperty({ type: () => CampaignBudgetDto })
  budget!: CampaignBudgetDto;

  @ApiProperty({ type: () => CampaignQuotaTotalsDto })
  quota!: CampaignQuotaTotalsDto;

  @ApiProperty({ type: () => FestivalSalesGroupDto, isArray: true })
  groups!: FestivalSalesGroupDto[];

  @ApiProperty({ type: () => FestivalReportOrderDto, isArray: true })
  orders!: FestivalReportOrderDto[];

  @ApiProperty({ type: () => CampaignQuotaOperationDto, isArray: true })
  quotaItems!: CampaignQuotaOperationDto[];

  page!: number;
  hasMore!: boolean;
}
