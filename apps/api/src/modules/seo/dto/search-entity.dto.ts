import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { SearchConsolePeriodDto } from './search-console.dto';
import {
  SearchOverviewMetricsDto,
  SearchOverviewPeriodDto,
  SearchOverviewRowDto,
  storedSearchTypes,
} from './search-overview.dto';

export const seoEntityKinds = ['product', 'category', 'brand', 'article'] as const;
export const seoOpportunityKinds = ['low-ctr', 'decline', 'growth'] as const;
export type SeoEntityKind = (typeof seoEntityKinds)[number];
export type SeoOpportunityKind = (typeof seoOpportunityKinds)[number];

export class SearchEntityPeriodDto extends SearchConsolePeriodDto {
  @ApiPropertyOptional({ enum: [...storedSearchTypes], default: 'web' })
  @IsOptional()
  @IsIn(storedSearchTypes)
  searchType?: (typeof storedSearchTypes)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 1_000_000, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  minimumImpressions?: number;
}

export class SearchEntityListQueryDto extends SearchEntityPeriodDto {
  @ApiProperty({ enum: [...seoEntityKinds] })
  @IsIn(seoEntityKinds)
  kind!: SeoEntityKind;

  @ApiPropertyOptional({ enum: [...seoOpportunityKinds] })
  @IsOptional()
  @IsIn(seoOpportunityKinds)
  opportunity?: SeoOpportunityKind;

  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  q?: string;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 100, default: 2 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  maximumCtrPercent?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1_000, default: 20 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1_000)
  minimumChangePercent?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100_000, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  minimumPreviousClicks?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  page?: number;
}

export class SearchEntityDetailQueryDto extends SearchEntityPeriodDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  urlId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  urlPage?: number;
}

export class SearchEntityIdentityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: [...seoEntityKinds] })
  kind!: SeoEntityKind;
  name!: string;
  @ApiProperty({ format: 'uri' })
  canonicalUrl!: string;
  seoNoIndex!: boolean;
}

export class SearchEntityListItemDto extends SearchEntityIdentityDto {
  @ApiProperty({ type: Number, nullable: true })
  clicks!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  impressions!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  ctr!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  clickChangePercent!: number | null;
  sufficient!: boolean;
  @ApiProperty({ enum: [...seoOpportunityKinds], isArray: true })
  opportunities!: SeoOpportunityKind[];
}

export class SearchEntityListDto {
  @ApiProperty({ type: () => SearchEntityListItemDto, isArray: true })
  items!: SearchEntityListItemDto[];
  page!: number;
  limit!: number;
  total!: number;
}

export class SearchEntityUrlDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uri' })
  reportedUrl!: string;
  @ApiProperty({ type: String, nullable: true })
  reportedSearch!: string | null;
  @ApiProperty({ type: String, nullable: true })
  recordedCanonicalPath!: string | null;
  @ApiProperty({ enum: ['direct', 'redirect'], nullable: true })
  matchedBy!: 'direct' | 'redirect' | null;
  isCanonical!: boolean;
}

export class SearchEntityDetailDto {
  @ApiProperty({ type: () => SearchEntityIdentityDto })
  entity!: SearchEntityIdentityDto;
  @ApiProperty({ type: () => SearchEntityUrlDto, nullable: true })
  selectedUrl!: SearchEntityUrlDto | null;
  @ApiProperty({ type: () => SearchEntityUrlDto, isArray: true })
  urls!: SearchEntityUrlDto[];
  urlPage!: number;
  urlLimit!: number;
  urlTotal!: number;
  @ApiProperty({ type: () => SearchOverviewPeriodDto })
  current!: SearchOverviewPeriodDto;
  @ApiProperty({ type: () => SearchOverviewPeriodDto })
  previous!: SearchOverviewPeriodDto;
  @ApiProperty({ type: () => SearchOverviewMetricsDto, nullable: true })
  change!: SearchOverviewMetricsDto | null;
  @ApiProperty({ type: () => SearchOverviewPeriodDto, isArray: true })
  daily!: SearchOverviewPeriodDto[];
  @ApiProperty({ type: () => SearchOverviewRowDto, isArray: true })
  topQueries!: SearchOverviewRowDto[];
  @ApiProperty({ type: () => SearchOverviewRowDto, isArray: true })
  devices!: SearchOverviewRowDto[];
  cappedQueryDays!: number;
  sufficient!: boolean;
}
