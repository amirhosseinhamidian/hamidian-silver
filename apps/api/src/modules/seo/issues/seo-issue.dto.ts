import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { SeoIssueSeverity, SeoIssueStatus } from '../../../generated/prisma/enums';

const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;
const severities = ['REVIEW', 'IMPORTANT', 'CRITICAL'] as const;

export class SeoIssuePageQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10000, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  page: number = 1;
}

export class SeoIssueListQueryDto extends SeoIssuePageQueryDto {
  @ApiPropertyOptional({ enum: [...statuses] })
  @IsOptional()
  @IsIn([...statuses])
  status?: SeoIssueStatus;
}

export class SeoIssueUpdateDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiPropertyOptional({ enum: [...statuses] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn([...statuses])
  status?: SeoIssueStatus;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  ownerId?: string | null;

  @ApiPropertyOptional({ maxLength: 1000 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class SeoIssuePersonDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

class SeoIssueEvidenceDto {
  @ApiProperty()
  sourceHref!: string;

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;

  @ApiProperty({ type: [String] })
  facts!: string[];

  @ApiProperty({ enum: [...severities] })
  severity!: SeoIssueSeverity;
}

class SeoIssueItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  rule!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty({ enum: [...severities] })
  severity!: SeoIssueSeverity;

  @ApiProperty({ enum: [...statuses] })
  status!: SeoIssueStatus;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  revision!: number;

  @ApiProperty()
  firstObservedAt!: string;

  @ApiProperty()
  observedAt!: string;

  @ApiProperty({ type: SeoIssuePersonDto, nullable: true })
  owner!: SeoIssuePersonDto | null;

  @ApiProperty({ type: SeoIssueEvidenceDto })
  evidence!: SeoIssueEvidenceDto;
}

export class SeoIssueListDto {
  @ApiProperty()
  configured!: boolean;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [SeoIssueItemDto] })
  items!: SeoIssueItemDto[];
}

class SeoIssueEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  kind!: string;

  @ApiProperty()
  at!: string;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: SeoIssuePersonDto, nullable: true })
  actor!: SeoIssuePersonDto | null;

  @ApiProperty({ type: SeoIssueEvidenceDto, nullable: true })
  evidence!: SeoIssueEvidenceDto | null;

  @ApiProperty({ type: [String] })
  deliveryStates!: string[];
}

export class SeoIssueDetailDto {
  @ApiProperty({ type: SeoIssueItemDto })
  issue!: SeoIssueItemDto;

  @ApiProperty({ type: [SeoIssuePersonDto] })
  owners!: SeoIssuePersonDto[];

  @ApiProperty({ type: [SeoIssueEventDto] })
  events!: SeoIssueEventDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  eventCount!: number;
}

export class SeoIssueScanDto {
  @ApiProperty()
  changed!: number;
}
