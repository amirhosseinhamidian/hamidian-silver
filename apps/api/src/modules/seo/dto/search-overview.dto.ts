import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { SearchConsolePeriodDto } from './search-console.dto';

export const storedSearchTypes = ['web', 'image', 'video', 'news'] as const;
const devices = ['DESKTOP', 'MOBILE', 'TABLET'] as const;
const brands = ['BRANDED', 'NON_BRANDED'] as const;
const segments = ['property', 'device', 'brand'] as const;
const tableKinds = ['query', 'page'] as const;
const sortFields = ['clicks', 'impressions', 'ctr', 'position', 'label'] as const;
const sortOrders = ['asc', 'desc'] as const;

export class SearchOverviewQueryDto extends SearchConsolePeriodDto {
  @ApiPropertyOptional({ enum: [...storedSearchTypes], default: 'web' })
  @IsOptional()
  @IsIn(storedSearchTypes)
  searchType?: (typeof storedSearchTypes)[number];

  @ApiPropertyOptional({ enum: [...devices] })
  @IsOptional()
  @IsIn(devices)
  device?: (typeof devices)[number];

  @ApiPropertyOptional({ enum: [...brands] })
  @IsOptional()
  @IsIn(brands)
  brand?: (typeof brands)[number];
}

export class SearchOverviewRowsQueryDto extends SearchOverviewQueryDto {
  @ApiProperty({ enum: [...tableKinds] })
  @IsIn(tableKinds)
  kind!: (typeof tableKinds)[number];

  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  q?: string;

  @ApiPropertyOptional({ enum: [...sortFields], default: 'clicks' })
  @IsOptional()
  @IsIn(sortFields)
  sort?: (typeof sortFields)[number];

  @ApiPropertyOptional({ enum: [...sortOrders], default: 'desc' })
  @IsOptional()
  @IsIn(sortOrders)
  direction?: (typeof sortOrders)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 5000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class SearchOverviewMetricsDto {
  clicks!: number;
  impressions!: number;

  @ApiProperty({ type: Number, nullable: true })
  ctr!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  averagePosition!: number | null;
}

export class SearchOverviewPeriodDto {
  @ApiProperty({ format: 'date' })
  startDate!: string;
  @ApiProperty({ format: 'date' })
  endDate!: string;

  days!: number;
  syncedDays!: number;
  dataDays!: number;

  @ApiProperty({ type: () => SearchOverviewMetricsDto, nullable: true })
  metrics!: SearchOverviewMetricsDto | null;
}

export class SearchOverviewSyncDto {
  enabled!: boolean;
  scheduledForType!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessAt!: string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  latestSyncedDate!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  pausedUntil!: string | null;
  @ApiProperty({ enum: ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED'], nullable: true })
  lastRunStatus!: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | null;
  @ApiProperty({ type: String, nullable: true })
  lastErrorCode!: string | null;
}

export class SearchOverviewDto {
  @ApiProperty({ type: String, nullable: true })
  property!: string | null;
  @ApiProperty({ enum: [...storedSearchTypes] })
  searchType!: (typeof storedSearchTypes)[number];
  @ApiProperty({ enum: [...segments] })
  scope!: (typeof segments)[number];
  @ApiProperty({ enum: ['America/Los_Angeles'] })
  timeZone!: 'America/Los_Angeles';
  @ApiProperty({ type: () => SearchOverviewSyncDto })
  sync!: SearchOverviewSyncDto;
  @ApiProperty({ type: () => SearchOverviewPeriodDto })
  current!: SearchOverviewPeriodDto;
  @ApiProperty({ type: () => SearchOverviewPeriodDto })
  previous!: SearchOverviewPeriodDto;
  @ApiProperty({ type: () => SearchOverviewMetricsDto, nullable: true })
  change!: SearchOverviewMetricsDto | null;
  @ApiProperty({ type: () => SearchOverviewPeriodDto, isArray: true })
  daily!: SearchOverviewPeriodDto[];
  @ApiProperty({ type: () => SearchOverviewPeriodDto, isArray: true })
  weekly!: SearchOverviewPeriodDto[];
}

export class SearchOverviewRowDto extends SearchOverviewMetricsDto {
  label!: string;
}

export class SearchOverviewRowsDto {
  @ApiProperty({ enum: [...tableKinds] })
  kind!: (typeof tableKinds)[number];
  available!: boolean;
  @ApiProperty({ enum: ['byProperty', 'byPage'] })
  aggregation!: 'byProperty' | 'byPage';
  syncedDays!: number;
  cappedDays!: number;
  @ApiProperty({ type: () => SearchOverviewRowDto, isArray: true })
  items!: SearchOverviewRowDto[];
  page!: number;
  limit!: number;
  total!: number;
}
