import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SeoAuditQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  runId?: string;
}

export class SeoAuditQueuedDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
}

class SeoAuditRunDto extends SeoAuditQueuedDto {
  @ApiProperty()
  ruleVersion!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true })
  finishedAt!: string | null;

  @ApiProperty()
  sitemapChecked!: boolean;
}

class SeoAuditRedirectDto {
  @ApiProperty()
  status!: number;

  @ApiProperty({ type: String, nullable: true })
  to!: string | null;
}

class SeoAuditObservationDto {
  @ApiProperty({ type: Number, nullable: true })
  status!: number | null;

  @ApiProperty()
  finalPath!: string;

  @ApiProperty({ type: [SeoAuditRedirectDto] })
  redirects!: SeoAuditRedirectDto[];

  @ApiProperty({ type: String, nullable: true })
  failure!: string | null;

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: [String] })
  canonicals!: string[];

  @ApiProperty({ type: [String] })
  robots!: string[];

  @ApiProperty({ type: [String] })
  schema!: string[];
}

class SeoAuditIssueDto {
  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: ['ERROR', 'REVIEW'] })
  severity!: 'ERROR' | 'REVIEW';

  @ApiProperty({ enum: ['NEW', 'EXISTING'] })
  state!: 'NEW' | 'EXISTING';

  @ApiProperty({ type: [String] })
  evidence!: string[];
}

class SeoAuditCheckDto {
  @ApiProperty()
  path!: string;

  @ApiProperty()
  source!: string;

  @ApiProperty({ type: Boolean, nullable: true })
  inSitemap!: boolean | null;

  @ApiProperty({ type: String, nullable: true })
  sourcePath!: string | null;

  @ApiProperty({ type: String, nullable: true })
  checkedAt!: string | null;

  @ApiProperty({ type: SeoAuditObservationDto, nullable: true })
  observation!: SeoAuditObservationDto | null;

  @ApiProperty({ type: [SeoAuditIssueDto] })
  issues!: SeoAuditIssueDto[];
}

export class SeoAuditOverviewDto {
  @ApiProperty()
  configured!: boolean;

  @ApiProperty({ type: [SeoAuditRunDto] })
  history!: SeoAuditRunDto[];

  @ApiProperty({ type: SeoAuditRunDto, nullable: true })
  run!: SeoAuditRunDto | null;

  @ApiProperty({ type: [SeoAuditCheckDto] })
  checks!: SeoAuditCheckDto[];
}
