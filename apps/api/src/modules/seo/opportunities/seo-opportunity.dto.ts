import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { SeoOpportunityStatus } from '../../../generated/prisma/enums';
import { opportunityActions, type OpportunityAction } from './seo-opportunity.service';

const statuses = ['PENDING', 'APPROVED', 'DEFERRED', 'TASK_CREATED', 'REJECTED'] as const;

export class SeoOpportunityPageDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10000, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  page: number = 1;
}

export class SeoOpportunityQueryDto extends SeoOpportunityPageDto {
  @ApiPropertyOptional({ enum: [...statuses] })
  @IsOptional()
  @IsIn([...statuses])
  status?: SeoOpportunityStatus;
}

export class SeoOpportunityUpdateDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiProperty({ enum: [...opportunityActions] })
  @IsIn([...opportunityActions])
  action!: OpportunityAction;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({ enum: [7, 14, 28] })
  @IsOptional()
  @IsInt()
  @IsIn([7, 14, 28])
  windowDays?: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  confounders?: string;
}

class SeoOpportunityMetricsDto {
  @ApiProperty()
  start!: string;

  @ApiProperty()
  end!: string;

  @ApiProperty()
  days!: number;

  @ApiProperty()
  observedDays!: number;

  @ApiProperty()
  cappedDays!: number;

  @ApiProperty({ type: Number, nullable: true })
  clicks!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  impressions!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  ctr!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  position!: number | null;
}

class SeoOpportunityComponentsDto {
  @ApiProperty()
  signal!: number;

  @ApiProperty()
  demand!: number;

  @ApiProperty()
  quality!: number;

  @ApiProperty()
  commercial!: number;

  @ApiProperty()
  stock!: number;
}

class SeoOpportunityEvidenceDto {
  @ApiProperty()
  reason!: string;

  @ApiProperty()
  recommendation!: string;

  @ApiProperty({ type: [String] })
  facts!: string[];

  @ApiProperty({ type: [String] })
  limitations!: string[];

  @ApiProperty()
  reportHref!: string;

  @ApiProperty({ type: SeoOpportunityMetricsDto })
  current!: SeoOpportunityMetricsDto;

  @ApiProperty({ type: SeoOpportunityMetricsDto })
  previous!: SeoOpportunityMetricsDto;

  @ApiProperty()
  stock!: string;

  @ApiProperty({ type: SeoOpportunityComponentsDto })
  components!: SeoOpportunityComponentsDto;
}

class SeoOpportunityItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  entityKind!: string;

  @ApiProperty({ format: 'uuid' })
  entityId!: string;

  @ApiProperty()
  rule!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  scoreVersion!: number;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ enum: [...statuses] })
  status!: SeoOpportunityStatus;

  @ApiProperty()
  revision!: number;

  @ApiProperty()
  refreshedAt!: string;

  @ApiProperty({ type: String, nullable: true })
  deferredUntil!: string | null;

  @ApiProperty({ type: SeoOpportunityEvidenceDto })
  evidence!: SeoOpportunityEvidenceDto;
}

class SeoOpportunityImpactDto {
  @ApiProperty({ enum: ['READY', 'WAITING_FOR_DATA'] })
  status!: 'READY' | 'WAITING_FOR_DATA';

  @ApiProperty({ type: SeoOpportunityMetricsDto })
  before!: SeoOpportunityMetricsDto;

  @ApiProperty({ type: SeoOpportunityMetricsDto })
  after!: SeoOpportunityMetricsDto;

  @ApiProperty({ type: Number, nullable: true })
  clickDifference!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  impressionDifference!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  ctrPointDifference!: number | null;
}

class SeoCorrectionTaskDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  instruction!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true })
  implementedOn!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  windowDays!: number | null;

  @ApiProperty({ type: String, nullable: true })
  changeNote!: string | null;

  @ApiProperty({ type: String, nullable: true })
  confounders!: string | null;

  @ApiProperty({ type: SeoOpportunityImpactDto, nullable: true })
  impact!: SeoOpportunityImpactDto | null;
}

class SeoOpportunityEventDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  at!: string;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: String, nullable: true })
  actor!: string | null;
}

export class SeoOpportunityListDto {
  @ApiProperty()
  configured!: boolean;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [SeoOpportunityItemDto] })
  items!: SeoOpportunityItemDto[];
}

export class SeoOpportunityDetailDto {
  @ApiProperty({ type: SeoOpportunityItemDto })
  item!: SeoOpportunityItemDto;

  @ApiProperty({ type: SeoCorrectionTaskDto, nullable: true })
  task!: SeoCorrectionTaskDto | null;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  eventCount!: number;

  @ApiProperty({ type: [SeoOpportunityEventDto] })
  history!: SeoOpportunityEventDto[];
}

export class SeoOpportunityRefreshDto {
  @ApiProperty()
  changed!: number;

  @ApiProperty()
  hasSource!: boolean;
}
