import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

class IndexPageDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10000, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  page: number = 1;
}

export class SeoIndexQueryDto extends IndexPageDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @IsOptional()
  @IsString()
  @Length(1, 180)
  q?: string;
}

export class SeoCoverageQueryDto extends IndexPageDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ maxLength: 240 })
  @IsOptional()
  @IsString()
  @Length(1, 240)
  reason?: string;
}

export class SeoCoverageUploadDto {
  @IsString()
  @Length(1, 120)
  label!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  reportDate!: string;
}

export class SeoInspectionQueuedDto {
  @ApiProperty()
  queued!: number;
}

export class SeoCoverageStoredDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
}

class SeoGoogleIndexDto {
  @ApiProperty()
  observedAt!: string;

  @ApiProperty()
  stale!: boolean;

  @ApiProperty()
  incomplete!: boolean;

  @ApiProperty({ type: String, nullable: true })
  verdict!: string | null;

  @ApiProperty({ type: String, nullable: true })
  coverageState!: string | null;

  @ApiProperty({ type: String, nullable: true })
  indexingState!: string | null;

  @ApiProperty({ type: String, nullable: true })
  pageFetchState!: string | null;

  @ApiProperty({ type: String, nullable: true })
  googleCanonical!: string | null;

  @ApiProperty({ type: String, nullable: true })
  userCanonical!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastCrawlAt!: string | null;
}

class SeoIndexTechnicalDto {
  @ApiProperty()
  observedAt!: string;

  @ApiProperty()
  finalPath!: string;

  @ApiProperty()
  stale!: boolean;

  @ApiProperty({ type: Number, nullable: true })
  status!: number | null;

  @ApiProperty({ type: String, nullable: true })
  canonical!: string | null;

  @ApiProperty({ type: Boolean, nullable: true })
  noindex!: boolean | null;

  @ApiProperty({ type: String, nullable: true })
  failure!: string | null;
}

class SeoIndexSitemapDto {
  @ApiProperty()
  observedAt!: string;

  @ApiProperty()
  present!: boolean;

  @ApiProperty()
  stale!: boolean;
}

class SeoIndexItemDto {
  @ApiProperty()
  url!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty()
  prioritySource!: string;

  @ApiProperty()
  queued!: boolean;

  @ApiProperty({ type: String, nullable: true })
  lastAttemptAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastError!: string | null;

  @ApiProperty({ type: SeoGoogleIndexDto, nullable: true })
  google!: SeoGoogleIndexDto | null;

  @ApiProperty({ type: SeoIndexTechnicalDto, nullable: true })
  technical!: SeoIndexTechnicalDto | null;

  @ApiProperty({ type: SeoIndexSitemapDto, nullable: true })
  sitemap!: SeoIndexSitemapDto | null;

  @ApiProperty({ type: [String] })
  differences!: string[];
}

export class SeoIndexOverviewDto {
  @ApiProperty()
  configured!: boolean;

  @ApiProperty({ type: String, nullable: true })
  property!: string | null;

  @ApiProperty({ type: String, nullable: true })
  origin!: string | null;

  @ApiProperty()
  automatic!: boolean;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  used!: number;

  @ApiProperty()
  pending!: number;

  @ApiProperty()
  budgetResetsAt!: string;

  @ApiProperty({ type: String, nullable: true })
  pausedUntil!: string | null;

  @ApiProperty({ type: String, nullable: true })
  pauseReason!: string | null;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [SeoIndexItemDto] })
  items!: SeoIndexItemDto[];
}

class SeoCoverageRowDto {
  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastCrawled!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  pages!: number | null;

  @ApiProperty({ type: String, nullable: true })
  validation!: string | null;
}

class SeoCoverageReportDto extends SeoCoverageStoredDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  reportDate!: string;

  @ApiProperty()
  importedAt!: string;

  @ApiProperty()
  rowCount!: number;
}

export class SeoCoverageOverviewDto {
  @ApiProperty({ type: [SeoCoverageReportDto] })
  history!: SeoCoverageReportDto[];

  @ApiProperty({ type: SeoCoverageReportDto, nullable: true })
  report!: SeoCoverageReportDto | null;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [SeoCoverageRowDto] })
  rows!: SeoCoverageRowDto[];
}
