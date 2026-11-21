import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';
import { GrowthRevenuePeriodDto, GrowthRevenueQueryDto } from './growth-revenue.dto';

export const growthDevices = ['desktop', 'mobile', 'tablet'] as const;
const reportDevices = [...growthDevices, 'unknown'] as const;
const slug = /^[\p{L}\p{N}_-]+$/u;
const token = /^[a-z0-9][a-z0-9._-]*$/;
export const funnelStages = [
  'view_item_list',
  'select_item',
  'view_item',
  'add_to_cart',
  'begin_checkout',
] as const;

export class GrowthDashboardQueryDto extends GrowthRevenueQueryDto {
  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional()
  @IsString()
  @Length(1, 180)
  @Matches(slug)
  category?: string;

  @ApiPropertyOptional({ enum: [...reportDevices] })
  @IsOptional()
  @IsIn(reportDevices)
  device?: (typeof reportDevices)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class GrowthMeasurementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  visitId!: string;

  @ApiProperty({ enum: [...funnelStages] })
  @IsIn(funnelStages)
  stage!: (typeof funnelStages)[number];

  @ApiProperty({ enum: [...growthDevices] })
  @IsIn(growthDevices)
  device!: (typeof growthDevices)[number];

  @ApiProperty({ type: String, isArray: true, maxItems: 24 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @IsString({ each: true })
  @Length(1, 180, { each: true })
  @Matches(slug, { each: true })
  productSlugs!: string[];

  @IsOptional()
  @IsString()
  @Length(1, 96)
  @Matches(token)
  source?: string;

  @IsOptional()
  @IsString()
  @Length(1, 96)
  @Matches(token)
  medium?: string;

  @IsOptional()
  @IsString()
  @Length(1, 96)
  @Matches(token)
  campaign?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(token)
  campaignId?: string;
}

export class RecordGrowthCostDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id!: string;

  @IsString()
  @Length(1, 64)
  @Matches(token)
  campaignId!: string;

  @IsString()
  @Length(1, 96)
  @Matches(token)
  source!: string;

  @IsString()
  @Length(1, 96)
  @Matches(token)
  medium!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  day!: string;

  @ApiProperty({ minimum: -2147483647, maximum: 2147483647 })
  @Type(() => Object)
  @IsInt()
  @Min(-2147483647)
  @Max(2147483647)
  @NotEquals(0)
  amountToman!: number;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  note?: string;
}

export class GrowthDashboardMetricsDto {
  confirmedCustomers!: number;
  submittedOrders!: number;
  confirmedOrders!: number;
  confirmedSubmissions!: number;
  collectedToman!: number;
  refundedToman!: number;
  netCollectedToman!: number;

  @ApiProperty({ type: Number, nullable: true })
  conversionPercent!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  averageOrderToman!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  recordedSpendToman!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  recordedSpendPerConfirmedOrderToman!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  measuredVisits!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  itemListViews!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  itemSelections!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  itemViews!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  cartAdds!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  checkouts!: number | null;
}

export class GrowthDashboardGroupDto extends GrowthDashboardMetricsDto {
  @ApiProperty({ type: String, nullable: true })
  source!: string | null;
  @ApiProperty({ type: String, nullable: true })
  medium!: string | null;
  @ApiProperty({ type: String, nullable: true })
  campaign!: string | null;
  @ApiProperty({ type: String, nullable: true })
  campaignId!: string | null;
}

export class GrowthDashboardDto {
  @ApiProperty({ type: () => GrowthRevenuePeriodDto })
  period!: GrowthRevenuePeriodDto;
  @ApiProperty({ type: () => GrowthDashboardMetricsDto })
  totals!: GrowthDashboardMetricsDto;
  @ApiProperty({ type: () => GrowthDashboardGroupDto, isArray: true })
  items!: GrowthDashboardGroupDto[];
  page!: number;
  limit!: number;
  total!: number;
}

export class GrowthCostDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  campaignId!: string;
  campaign!: string;
  source!: string;
  medium!: string;
  @ApiProperty({ format: 'date' })
  day!: string;
  amountToman!: number;
  @ApiProperty({ type: String, nullable: true })
  note!: string | null;
  @ApiProperty({ format: 'date-time' })
  recordedAt!: string;
}

export class GrowthCostsDto {
  @ApiProperty({ type: () => GrowthCostDto, isArray: true })
  items!: GrowthCostDto[];
  page!: number;
  limit!: number;
  total!: number;
}
