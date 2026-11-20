import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  SEARCH_CONSOLE_ERROR_CODES,
  type SearchConsoleErrorCode,
} from '../search-console/search-console-errors';

const dimensions = ['date', 'query', 'page', 'device'] as const;
const filterDimensions = ['query', 'page', 'device'] as const;
const operators = ['equals', 'notEquals', 'contains', 'notContains'] as const;
const searchTypes = [
  'web',
  'image',
  'video',
  'news',
  'discover',
  'googleNews',
  'webMultimodal',
] as const;
const aggregationTypes = ['auto', 'byPage', 'byProperty'] as const;
const datePattern = /^[1-9]\d{3}-\d{2}-\d{2}$/;

export class SearchConsolePeriodDto {
  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  @Matches(datePattern)
  startDate!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  @Matches(datePattern)
  endDate!: string;
}

export class SearchConsoleFilterDto {
  @ApiProperty({ enum: [...filterDimensions] })
  @IsIn(filterDimensions)
  dimension!: (typeof filterDimensions)[number];

  @ApiProperty({ enum: [...operators] })
  @IsIn(operators)
  operator!: (typeof operators)[number];

  @IsString()
  @Length(1, 2048)
  expression!: string;
}

export class SearchConsolePerformanceQueryDto extends SearchConsolePeriodDto {
  @ApiPropertyOptional({ type: String, isArray: true, enum: [...dimensions] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(dimensions, { each: true })
  dimensions?: (typeof dimensions)[number][];

  @ApiPropertyOptional({ enum: [...searchTypes] })
  @IsOptional()
  @IsIn(searchTypes)
  searchType?: (typeof searchTypes)[number];

  @ApiPropertyOptional({ enum: [...aggregationTypes] })
  @IsOptional()
  @IsIn(aggregationTypes)
  aggregation?: (typeof aggregationTypes)[number];

  @ApiPropertyOptional({ type: () => SearchConsoleFilterDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => SearchConsoleFilterDto)
  filters?: SearchConsoleFilterDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25_000)
  rowLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  startRow?: number;
}

export class SearchConsoleMetricsDto {
  clicks!: number;
  impressions!: number;
  ctr!: number;
  @ApiProperty({ type: Number, nullable: true })
  averagePosition!: number | null;
}

export class SearchConsoleRowDto extends SearchConsoleMetricsDto {
  @ApiProperty({ type: String, isArray: true })
  keys!: string[];
}

export class SearchConsolePerformanceDto {
  property!: string;
  @ApiProperty({ type: () => SearchConsoleRowDto, isArray: true })
  rows!: SearchConsoleRowDto[];
  @ApiProperty({ type: String, isArray: true, enum: [...dimensions] })
  dimensions!: (typeof dimensions)[number][];
  @ApiProperty({ enum: [...searchTypes] })
  searchType!: (typeof searchTypes)[number];
  @ApiProperty({ enum: [...aggregationTypes], nullable: true })
  aggregation!: (typeof aggregationTypes)[number] | null;
  @ApiProperty({ enum: ['property_total', 'page_total', 'filtered_total', 'grouped_rows'] })
  scope!: 'property_total' | 'page_total' | 'filtered_total' | 'grouped_rows';
  @ApiProperty({ type: Number, nullable: true })
  nextStartRow!: number | null;
}

export class SearchConsoleBrandPerformanceDto {
  property!: string;
  @ApiProperty({ enum: ['google', 'estimated'] })
  classification!: 'google' | 'estimated';
  @ApiProperty({ type: () => SearchConsoleMetricsDto, nullable: true })
  branded!: SearchConsoleMetricsDto | null;
  @ApiProperty({ type: () => SearchConsoleMetricsDto, nullable: true })
  nonBranded!: SearchConsoleMetricsDto | null;
}

export class SearchConsoleSitemapContentDto {
  type!: string;
  @ApiProperty({ type: Number, nullable: true })
  submitted!: number | null;
}

export class SearchConsoleSitemapDto {
  path!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSubmitted!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastDownloaded!: string | null;
  @ApiProperty({ type: Boolean, nullable: true })
  isPending!: boolean | null;
  @ApiProperty({ type: Boolean, nullable: true })
  isSitemapIndex!: boolean | null;
  @ApiProperty({ type: Number, nullable: true })
  warnings!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  errors!: number | null;
  @ApiProperty({ type: () => SearchConsoleSitemapContentDto, isArray: true })
  contents!: SearchConsoleSitemapContentDto[];
}

export class SearchConsoleSitemapsDto {
  property!: string;
  @ApiProperty({ type: () => SearchConsoleSitemapDto, isArray: true })
  items!: SearchConsoleSitemapDto[];
}

export class SearchConsoleConnectionDto {
  property!: string;
  @ApiProperty({ enum: ['connected', 'unavailable'] })
  status!: 'connected' | 'unavailable';
  @ApiPropertyOptional({ enum: [...SEARCH_CONSOLE_ERROR_CODES] })
  reason?: SearchConsoleErrorCode;
  @ApiPropertyOptional()
  message?: string;
}
